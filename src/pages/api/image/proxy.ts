import type { APIRoute } from "astro";
import { withRateLimit, RATE_LIMITS } from "@/utils/apiSecurity";
import { isAllowedUrl } from "@/config";

const IMAGE_MAX_BYTES = parseInt(process.env.IMAGE_MAX_BYTES || "5242880"); // 5MB default
const EDGE_MAX_AGE = parseInt(process.env.IMAGE_EDGE_S_MAXAGE || String(24 * 60 * 60)); // s-maxage seconds (default 1 day)

async function streamWithLimit(upstream: Response): Promise<ReadableStream<Uint8Array>> {
  const reader = upstream.body!.getReader();
  let received = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        if (value) {
          received += value.byteLength;
          if (IMAGE_MAX_BYTES && received > IMAGE_MAX_BYTES) {
            try { await reader.cancel(); } catch (_) {}
            controller.error(new Error("Image too large"));
            return;
          }
          controller.enqueue(value);
        }
      } catch (err) {
        controller.error(err as any);
      }
    },
    cancel() {
      try { reader.cancel(); } catch (_) {}
    }
  });
}

async function fetchWithBackoff(url: string, maxRetries = 3) {
  let attempt = 0;
  let lastErr: any = null;
  while (attempt <= maxRetries) {
    try {
      // per-attempt timeout
      const controller = new AbortController();
      const timeoutMs = 8000; // 8s
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      // Treat 429 and 5xx as retryable
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        lastErr = new Error(`upstream status ${res.status}`);
        lastErr.status = res.status;
        throw lastErr;
      }
      return res;
    } catch (err: any) {
      lastErr = err;
      attempt++;
      if (attempt > maxRetries) break;
      const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000) + Math.floor(Math.random() * 300);
      console.warn(`[IMAGE PROXY] fetch attempt ${attempt} for ${url} failed: ${err?.message || err}. retrying in ${delay}ms`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  console.error(`[IMAGE PROXY] fetchWithBackoff giving up for ${url} after ${attempt} attempts. lastErr:`, lastErr);
  try {
    // Append debug log to repository root for local inspection
    const fs = await import('fs');
    const entry = `${new Date().toISOString()} | URL: ${url} | attempts: ${attempt} | lastErr: ${String(lastErr)}\n`;
    try { fs.appendFileSync('.image-proxy-debug.log', entry); } catch (e) { /* ignore */ }
  } catch (e) {}
  throw lastErr || new Error("failed to fetch upstream");
}

// Simple in-process concurrency limiter and per-host cooldown to avoid bursting upstream
const MAX_CONCURRENT_FETCHES = parseInt(process.env.IMAGE_PROXY_MAX_CONCURRENT || "6");
let currentFetches = 0;
const queue: Array<() => void> = [];

function acquireSlot(): Promise<() => void> {
  return new Promise(resolve => {
    const tryAcquire = () => {
      if (currentFetches < MAX_CONCURRENT_FETCHES) {
        currentFetches++;
        resolve(() => {
          currentFetches = Math.max(0, currentFetches - 1);
          // pop next queued
          const next = queue.shift();
          if (next) next();
        });
      } else {
        queue.push(tryAcquire);
      }
    };
    tryAcquire();
  });
}

const HOST_COOLDOWN_MS = parseInt(process.env.IMAGE_PROXY_HOST_COOLDOWN_MS || "350");
const hostLastRequest = new Map<string, number>();

async function waitForHostCooldown(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname;
    const last = hostLastRequest.get(host) || 0;
    const now = Date.now();
    const delta = now - last;
    if (delta < HOST_COOLDOWN_MS) {
      await new Promise(res => setTimeout(res, HOST_COOLDOWN_MS - delta));
    }
    hostLastRequest.set(host, Date.now());
  } catch (e) {
    // ignore parse errors
  }
}

export const GET: APIRoute = withRateLimit(async ({ request }) => {
  try {
    const reqUrl = new URL(request.url);
    const urlParam = reqUrl.searchParams.get("url");
    if (!urlParam) return new Response("url query param required", { status: 400 });
    let decoded = urlParam;
    try {
      decoded = decodeURIComponent(urlParam);
    } catch (e) {
      // ignore decode errors and use raw param
      decoded = urlParam;
    }

    if (!isAllowedUrl(decoded)) {
      console.warn(`[IMAGE PROXY] blocked url not in allowlist: ${decoded}`);
      return new Response("url not allowed", { status: 403 });
    }

    console.info(`[IMAGE PROXY] fetching ${decoded}`);

    let upstream: Response | undefined;
    let release: (() => void) | null = null;
    try {
      release = await acquireSlot();
      await waitForHostCooldown(decoded);
      upstream = await fetchWithBackoff(decoded, 3);
    } catch (err: any) {
      console.error(`[IMAGE PROXY] upstream fetch failed for ${decoded}:`, err);
      const status = err?.status || 502;
      const msg = err?.message || String(err);
      return new Response(`failed to fetch upstream image (status: ${status}) - ${msg}`, { status: 502 });
    } finally {
      if (release) release();
    }

    if (!upstream) {
      console.error(`[IMAGE PROXY] no upstream response for ${decoded}`);
      return new Response("failed to fetch upstream image", { status: 502 });
    }

    // If upstream returned an error status, pass it through where reasonable (helps surface 404/403)
    if (!upstream.ok) {
      const upstreamContentType = upstream.headers.get('content-type') || '';
      const headers = new Headers();
      upstream.headers.forEach((v, k) => headers.set(k, v));
      console.warn(`[IMAGE PROXY] passing through upstream status ${upstream.status} for ${decoded}`);
      const body = await upstream.arrayBuffer();
      return new Response(body, { status: upstream.status, headers });
    }

    const upstreamLengthHeader = upstream.headers.get("content-length");
    if (upstreamLengthHeader && Number(upstreamLengthHeader) > IMAGE_MAX_BYTES) {
      console.warn(`[IMAGE PROXY] upstream image too large (${upstreamLengthHeader} bytes): ${decoded}`);
      return new Response("image too large", { status: 413 });
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    if (upstreamLengthHeader) headers.set("Content-Length", upstreamLengthHeader);
    headers.set("Cache-Control", `public, max-age=3600, s-maxage=${EDGE_MAX_AGE}, stale-while-revalidate=86400`);
    const etag = upstream.headers.get("etag");
    if (etag) headers.set("ETag", etag);

    const body = await streamWithLimit(upstream);

    return new Response(body, { status: 200, headers });
  } catch (err: any) {
    console.error("proxy image error", err);
    const msg = err?.message ?? String(err);
    if (msg.includes("Image too large")) {
      return new Response("image too large", { status: 413 });
    }
    return new Response("internal error", { status: 500 });
  }
}, RATE_LIMITS.MODERATE);
