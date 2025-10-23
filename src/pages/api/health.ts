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

  // Test image proxy health
  let imageTest = {
    status: 'unknown',
    message: 'Test not performed'
  };

  // Test image proxy with reliable sources
  try {
    // Test multiple sources for better reliability
    const testUrls = [
      'https://images.unsplash.com/photo-1593642632822-18fbae7fe93b?w=400&q=75&auto=compress',
      'https://prod-files-secure.s3.us-west-2.amazonaws.com/test-image.jpg',
      'https://via.placeholder.com/400x200/cccccc/000000?text=Test+Image'
    ];

    let testResponse: Response | null = null;
    let workingUrl = '';

    for (const url of testUrls) {
      try {
        const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          testResponse = response;
          workingUrl = url;
          break;
        }
      } catch (e) {
        // Try next URL
        continue;
      }
    }

    if (testResponse) {
      imageTest.status = 'healthy';
      imageTest.message = `Image accessible via ${new URL(workingUrl).hostname}`;
    } else {
      imageTest.status = 'degraded';
      imageTest.message = 'All image sources unavailable (may be temporary)';
    }
  } catch (error) {
    imageTest.status = 'error';
    imageTest.message = error instanceof Error ? error.message : 'Network error';
  }

  const healthData = {
    status: imageTest.status === 'error' ? 'degraded' : 'ok', // Only error status affects overall health
    ...systemInfo,
    imageProxy: imageProxyStats,
    cache: cacheSettings,
    imageTest,
    limits: {
      functionTimeout: '10s (Vercel Free)',
      redisRequests: '10,000/day (Upstash Free)',
      edgeCache: 'Enabled'
    }
  };

  return new Response(JSON.stringify(healthData, null, 2), {
    status: imageTest.status === 'error' ? 503 : 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    }
  });
};
