import { isAllowedUrl, isS3Url, optimizeImageUrl } from "@/config";

// Lightweight in-memory cache for S3 URL refresh (Free Plan optimized)
const s3RefreshAttempts = new Map<string, { count: number; lastAttempt: number }>();
const S3_REFRESH_WINDOW_MS = 2 * 60 * 1000; // 2 minutes (shorter for free plan)
const MAX_S3_REFRESH_ATTEMPTS = 3; // Allow more retries for expired URLs
const MAX_CACHE_SIZE = 100; // Limit memory usage

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

export async function fetchWithBackoff(url: string, maxRetries = 2) {
  let attempt = 0;
  let lastErr: any = null;
  while (attempt <= maxRetries) {
    try {
      const controller = new AbortController();
      // Shorter timeout for Free Plan (10s limit)
      const timeoutMs = parseInt(
        process.env.IMAGE_PROXY_FETCH_TIMEOUT_MS || "8000"
      ); // 8s default (under 10s limit)
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
      // Shorter delays for Free Plan
      const delay =
        Math.min(1000 * Math.pow(2, attempt - 1), 5000) +
        Math.floor(Math.random() * 200);
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
// Lower concurrency for Free Plan to avoid timeouts
const MAX_CONCURRENT_FETCHES = parseInt(
  process.env.IMAGE_PROXY_MAX_CONCURRENT || "4"
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

// Longer cooldown for Free Plan to avoid rate limiting
const HOST_COOLDOWN_MS = parseInt(
  process.env.IMAGE_PROXY_HOST_COOLDOWN_MS || "500"
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

function shouldRetryS3Url(url: string): boolean {
  const now = Date.now();
  const attempt = s3RefreshAttempts.get(url);

  // Clear old attempts outside the window
  if (attempt && now - attempt.lastAttempt > S3_REFRESH_WINDOW_MS) {
    s3RefreshAttempts.delete(url);
    return true;
  }

  // Check if we've exceeded max attempts
  if (!attempt) return true;
  return attempt.count < MAX_S3_REFRESH_ATTEMPTS;
}

function recordS3Attempt(url: string): void {
  const now = Date.now();
  const existing = s3RefreshAttempts.get(url);

  if (existing) {
    existing.count++;
    existing.lastAttempt = now;
  } else {
    s3RefreshAttempts.set(url, { count: 1, lastAttempt: now });
  }

  // Prevent memory leak - clean old entries
  if (s3RefreshAttempts.size > MAX_CACHE_SIZE) {
    const oldest = Array.from(s3RefreshAttempts.entries())
      .reduce((a, b) => a[1].lastAttempt < b[1].lastAttempt ? a : b);
    s3RefreshAttempts.delete(oldest[0]);
  }
}

export async function handleProxyUrl(decoded: string): Promise<Response> {
  if (!decoded) return new Response("url required", { status: 400 });
  if (!isAllowedUrl(decoded))
    return new Response("url not allowed", { status: 403 });

  let upstream: Response | undefined;
  let release: (() => void) | null = null;
  const startTime = Date.now();
  const isS3 = isS3Url(decoded);

  // Optimize URLs for Free Plan (especially Unsplash)
  const optimizedUrl = optimizeImageUrl(decoded);

  try {
    release = await acquireSlot();
    await waitForHostCooldown(optimizedUrl);
    upstream = await fetchWithBackoff(optimizedUrl, 3);

    // Log successful upstream fetch (async best-effort)
    (async () => {
      try {
        const dur = Date.now() - startTime;
        debugLog(decoded, upstream?.status || 0, dur);
      } catch (e) {
        // ignore logging errors
      }
    })();

    // Clear refresh attempts on success for S3 URLs
    if (isS3 && upstream?.ok) {
      s3RefreshAttempts.delete(decoded);
    }

    // Log optimization for debugging
    if (optimizedUrl !== decoded) {
      console.log(`[IMAGE PROXY] Optimized URL: ${new URL(decoded).hostname} -> size reduced`);
    }
  } catch (err: any) {
    console.error(`[IMAGE PROXY] upstream fetch failed for ${decoded}:`, err);
    const status = err?.status || 502;
    const msg = err?.message || String(err);
    const headers = new Headers();
    headers.set("Content-Type", "text/plain; charset=utf-8");

    // For S3 URLs with network errors, use shorter cache to allow retry
    const errorTTL = (isS3 && shouldRetryS3Url(decoded)) ? 15 : ERROR_S_MAXAGE;
    headers.set(
      "Cache-Control",
      `public, max-age=0, s-maxage=${errorTTL}, stale-while-revalidate=30`
    );

    // Record attempt for S3 URLs
    if (isS3) {
      recordS3Attempt(decoded);
    }

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

    // Special handling for S3 signed URL expiration (403 errors)
    const isLikelyExpired = upstream.status === 403 && isS3;

    // Override cache control for non-OK upstream responses
    // For S3 403 errors, use even shorter TTL to force refresh
    // Only allow retry if we haven't exceeded max attempts
    const canRetry = isLikelyExpired && shouldRetryS3Url(decoded);
    // Very short TTL for Free Plan to avoid stale cache
    const errorTTL = canRetry ? 10 : Math.min(ERROR_S_MAXAGE, 20);

    headers.set(
      "Cache-Control",
      `public, max-age=0, s-maxage=${errorTTL}, stale-while-revalidate=10`
    );

    // Record attempt for expired S3 URLs
    if (isLikelyExpired) {
      recordS3Attempt(decoded);
    }

    console.warn(
      `[IMAGE PROXY] passing through upstream status ${upstream.status} for ${decoded} (short TTL applied${isLikelyExpired ? ` - likely expired S3 URL${canRetry ? ' - retry allowed' : ' - max retries exceeded'}` : ''})`
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
  // For S3 URLs, use much shorter cache time to avoid serving expired signed URLs
  // Notion S3 URLs expire in 1 hour, so cache must be shorter
  const maxAge = isS3 ? 300 : 1800; // 5 minutes for S3, 30 minutes for others
  const sMaxAge = isS3 ? 600 : Math.min(EDGE_MAX_AGE, 7200); // 10 minutes for S3, 2 hours for others

  headers.set(
    "Cache-Control",
    `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=300`
  );
  const etag = upstream.headers.get("etag");
  if (etag) headers.set("ETag", etag);

  const body = await streamWithLimit(upstream);
  return new Response(body, { status: 200, headers });
}
