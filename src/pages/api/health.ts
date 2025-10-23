import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  const now = new Date().toISOString();
  const uptime = process.uptime();

  // Basic system info (Free Plan friendly)
  const systemInfo = {
    timestamp: now,
    uptime: Math.floor(uptime),
    environment: process.env.NODE_ENV || 'unknown',
    region: process.env.VERCEL_REGION || 'unknown',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
    }
  };

  // Image proxy stats
  const imageProxyStats = {
    maxConcurrent: parseInt(process.env.IMAGE_PROXY_MAX_CONCURRENT || "4"),
    timeout: parseInt(process.env.IMAGE_PROXY_FETCH_TIMEOUT_MS || "8000"),
    cooldown: parseInt(process.env.IMAGE_PROXY_HOST_COOLDOWN_MS || "500"),
    maxBytes: parseInt(process.env.IMAGE_MAX_BYTES || "3145728")
  };

  // Cache settings
  const cacheSettings = {
    posts: parseInt(process.env.POSTS_CACHE_TTL || "900000"),
    tags: parseInt(process.env.TAGS_CACHE_TTL || "1800000"),
    imageError: parseInt(process.env.IMAGE_ERROR_S_MAXAGE || "30")
  };

  const healthData = {
    status: 'ok',
    ...systemInfo,
    imageProxy: imageProxyStats,
    cache: cacheSettings,
    limits: {
      functionTimeout: '10s (Vercel Free)',
      redisRequests: '10,000/day (Upstash Free)',
      edgeCache: 'Enabled'
    }
  };

  return new Response(JSON.stringify(healthData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    }
  });
};
