import { isAllowedUrl } from "@/config";

const IMAGE_MAX_BYTES = parseInt(process.env.IMAGE_MAX_BYTES || "5242880"); // 5MB default
const EDGE_MAX_AGE = parseInt(
  process.env.IMAGE_EDGE_S_MAXAGE || String(24 * 60 * 60)
);
const ERROR_S_MAXAGE = parseInt(process.env.IMAGE_ERROR_S_MAXAGE || "60");

// Debug logging - only enabled in development or with DEBUG_IMAGE_PROXY=true
const DEBUG_IMAGE_PROXY =
  process.env.DEBUG_IMAGE_PROXY === "true" ||
  process.env.NODE_ENV === "development";

function debugLog(url: string, status: number, duration: number) {
  if (DEBUG_IMAGE_PROXY) {
    const timestamp = new Date().toISOString();
    console.log(
      `[IMAGE-PROXY] ${timestamp} | ${url} | status: ${status} | duration_ms: ${duration}`
    );
  }
}

export async function streamWithLimit(
  upstream: Response
): Promise<ReadableStream<Uint8Array>> {
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
            try {
              await reader.cancel();
            } catch (_) {}
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
      try {
        reader.cancel();
      } catch (_) {}
    },
  });
}

export async function fetchWithBackoff(url: string, maxRetries = 3) {
  let attempt = 0;
  let lastErr: any = null;
  while (attempt <= maxRetries) {
    try {
      const controller = new AbortController();
      // Increase client-side fetch timeout to be more tolerant of slow upstreams
      const timeoutMs = parseInt(
        process.env.IMAGE_PROXY_FETCH_TIMEOUT_MS || "12000"
      ); // 12s default
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
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
      const delay =
        Math.min(2000 * Math.pow(2, attempt - 1), 10000) +
        Math.floor(Math.random() * 300);
      console.warn(
        `[IMAGE PROXY] fetch attempt ${attempt} for ${url} failed: ${err?.message || err}. retrying in ${delay}ms`
      );
      await new Promise(res => setTimeout(res, delay));
    }
  }
  console.error(
    `[IMAGE PROXY] fetchWithBackoff giving up for ${url} after ${attempt} attempts. lastErr:`,
    lastErr
  );
  throw lastErr || new Error("failed to fetch upstream");
}

// concurrency limiter & per-host cooldown
// Increase default client concurrency to better utilize available proxy throughput while remaining configurable
const MAX_CONCURRENT_FETCHES = parseInt(
  process.env.IMAGE_PROXY_MAX_CONCURRENT || "10"
);
let currentFetches = 0;
const queue: Array<() => void> = [];

export function acquireSlot(): Promise<() => void> {
  return new Promise(resolve => {
    const tryAcquire = () => {
      if (currentFetches < MAX_CONCURRENT_FETCHES) {
        currentFetches++;
        resolve(() => {
          currentFetches = Math.max(0, currentFetches - 1);
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

// Reduce default per-host cooldown slightly to allow more frequent requests to the same host where safe
const HOST_COOLDOWN_MS = parseInt(
  process.env.IMAGE_PROXY_HOST_COOLDOWN_MS || "200"
);
const hostLastRequest = new Map<string, number>();

export async function waitForHostCooldown(url: string) {
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
  } catch (e) {}
}

export async function handleProxyUrl(decoded: string): Promise<Response> {
  if (!decoded) return new Response("url required", { status: 400 });
  if (!isAllowedUrl(decoded))
    return new Response("url not allowed", { status: 403 });

  let upstream: Response | undefined;
  let release: (() => void) | null = null;
  const startTime = Date.now();
  try {
    release = await acquireSlot();
    await waitForHostCooldown(decoded);
    upstream = await fetchWithBackoff(decoded, 3);
    // Log successful upstream fetch (async best-effort)
    (async () => {
      try {
        const dur = Date.now() - startTime;
        debugLog(decoded, upstream?.status || 0, dur);
      } catch (e) {
        // ignore logging errors
      }
    })();
  } catch (err: any) {
    console.error(`[IMAGE PROXY] upstream fetch failed for ${decoded}:`, err);
    const status = err?.status || 502;
    const msg = err?.message || String(err);
    const headers = new Headers();
    headers.set("Content-Type", "text/plain; charset=utf-8");
    headers.set(
      "Cache-Control",
      `public, max-age=0, s-maxage=${ERROR_S_MAXAGE}, stale-while-revalidate=60`
    );
    return new Response(
      `failed to fetch upstream image (status: ${status}) - ${msg}`,
      { status: 502, headers }
    );
  } finally {
    if (release) release();
  }

  if (!upstream)
    return new Response("failed to fetch upstream image", { status: 502 });

  if (!upstream.ok) {
    // Copy relevant headers but force a short edge TTL for errored responses so the edge
    // doesn't cache a 404/403 for a long time. Preserve content-type and body.
    const headers = new Headers();
    upstream.headers.forEach((v, k) => headers.set(k, v));
    // Override cache control for non-OK upstream responses
    headers.set(
      "Cache-Control",
      `public, max-age=0, s-maxage=${ERROR_S_MAXAGE}, stale-while-revalidate=60`
    );
    console.warn(
      `[IMAGE PROXY] passing through upstream status ${upstream.status} for ${decoded} (short TTL applied)`
    );
    const body = await upstream.arrayBuffer();
    return new Response(body, { status: upstream.status, headers });
  }

  const upstreamLengthHeader = upstream.headers.get("content-length");
  if (upstreamLengthHeader && Number(upstreamLengthHeader) > IMAGE_MAX_BYTES) {
    console.warn(
      `[IMAGE PROXY] upstream image too large (${upstreamLengthHeader} bytes): ${decoded}`
    );
    return new Response("image too large", { status: 413 });
  }

  const contentType =
    upstream.headers.get("content-type") || "application/octet-stream";
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  if (upstreamLengthHeader) headers.set("Content-Length", upstreamLengthHeader);
  headers.set(
    "Cache-Control",
    `public, max-age=3600, s-maxage=${EDGE_MAX_AGE}, stale-while-revalidate=86400`
  );
  const etag = upstream.headers.get("etag");
  if (etag) headers.set("ETag", etag);

  const body = await streamWithLimit(upstream);
  return new Response(body, { status: 200, headers });
}
