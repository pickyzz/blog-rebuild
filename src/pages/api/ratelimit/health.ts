import type { APIRoute } from "astro";
import { Redis } from "@upstash/redis";
import { validateConfiguration, getEnvironmentRateLimitConfig, type RateLimitType } from "@/utils/ratelimit/config";
import { withUpstashRateLimit } from "@/utils/ratelimit/upstashRatelimit";

// Initialize Redis client for health checks
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// GET /api/ratelimit/health - Check rate limiting system health
export const GET: APIRoute = withUpstashRateLimit(async ({ request }) => {
  try {
    const startTime = Date.now();

    // Configuration validation
    const configValidation = validateConfiguration();
    const rateLimitConfigs = getEnvironmentRateLimitConfig();

    // Redis connectivity test
    let redisHealth = {
      status: "unknown" as "healthy" | "unhealthy" | "unknown",
      latency: 0,
      error: null as string | null,
      info: {
        version: "unknown",
        uptime: 0,
        memory: "unknown",
      }
    };

    try {
      const redisStart = Date.now();
      const pong = await redis.ping();
      redisHealth.latency = Date.now() - redisStart;

      if (pong === "PONG") {
        redisHealth.status = "healthy";

        // Get additional Redis info
        try {
          const info = await redis.info();
          redisHealth.info = {
            version: info.match(/redis_version:([^\r\n]+)/)?.[1] || "unknown",
            uptime: parseInt(info.match(/uptime_in_seconds:([^\r\n]+)/)?.[1] || "0"),
            memory: info.match(/used_memory_human:([^\r\n]+)/)?.[1] || "unknown",
          };
        } catch (infoError) {
          console.warn("Failed to get Redis info:", infoError);
        }
      } else {
        redisHealth.status = "unhealthy";
        redisHealth.error = "Unexpected ping response";
      }
    } catch (redisError) {
      redisHealth.status = "unhealthy";
      redisHealth.error = redisError instanceof Error ? redisError.message : "Unknown Redis error";
    }

    // Rate limit statistics
    const rateLimitStats: Record<RateLimitType, {
      config: any;
      activeKeys: number;
      sampleUsage?: any;
    }> = {} as any;

    for (const [type, config] of Object.entries(rateLimitConfigs)) {
      const rateLimitType = type as RateLimitType;

      try {
        // Count active keys for this rate limit type
        const keys = await redis.keys(`${config.prefix}:*`);

        // Sample a few keys to check usage
        let sampleUsage = null;
        if (keys.length > 0) {
          try {
            const sampleKey = keys[0];
            const sampleData = await redis.get(sampleKey);
            if (sampleData) {
              sampleUsage = JSON.parse(sampleData);
            }
          } catch (sampleError) {
            // Ignore sample errors
          }
        }

        rateLimitStats[rateLimitType] = {
          config: {
            window: config.window,
            max: config.max,
            prefix: config.prefix,
          },
          activeKeys: keys.length,
          sampleUsage,
        };
      } catch (statsError) {
        rateLimitStats[rateLimitType] = {
          config: {
            window: config.window,
            max: config.max,
            prefix: config.prefix,
          },
          activeKeys: -1,
        };
      }
    }

    // Overall health assessment
    const overallHealth = {
      status: configValidation.isValid && redisHealth.status === "healthy" ? "healthy" : "unhealthy",
      score: 100,
      issues: [] as string[],
    };

    if (!configValidation.isValid) {
      overallHealth.issues.push(...configValidation.errors);
      overallHealth.score -= 30;
    }

    if (redisHealth.status !== "healthy") {
      overallHealth.issues.push(`Redis connection: ${redisHealth.error || "Unknown error"}`);
      overallHealth.score -= 40;
    }

    if (redisHealth.latency > 1000) {
      overallHealth.issues.push(`High Redis latency: ${redisHealth.latency}ms`);
      overallHealth.score -= 10;
    }

    // Check if any rate limit types have excessive active keys
    const totalActiveKeys = Object.values(rateLimitStats).reduce((sum, stat) => sum + Math.max(0, stat.activeKeys), 0);
    if (totalActiveKeys > 10000) {
      overallHealth.issues.push(`High number of active rate limit entries: ${totalActiveKeys}`);
      overallHealth.score -= 10;
    }

    const responseTime = Date.now() - startTime;

    const healthResponse = {
      status: overallHealth.status,
      score: Math.max(0, overallHealth.score),
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      environment: process.env.NODE_ENV || "unknown",

      // Configuration status
      configuration: {
        isValid: configValidation.isValid,
        errors: configValidation.errors,
        rateLimits: rateLimitStats,
      },

      // Redis status
      redis: redisHealth,

      // Overall health
      health: {
        status: overallHealth.status,
        score: overallHealth.score,
        issues: overallHealth.issues,
      },

      // System info
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
      },
    };

    return new Response(JSON.stringify(healthResponse, null, 2), {
      status: overallHealth.status === "healthy" ? 200 : 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "X-Health-Status": overallHealth.status,
        "X-Health-Score": overallHealth.score.toString(),
      },
    });

  } catch (error) {
    console.error("Rate limit health check failed:", error);

    return new Response(JSON.stringify({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "X-Health-Status": "error",
      },
    });
  }
}, "LENIENT"); // Use lenient rate limiting for health checks

// POST /api/ratelimit/health - Manual health check with detailed diagnostics
export const POST: APIRoute = withUpstashRateLimit(async ({ request }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const { detailed = false, cleanup = false } = body;

    let cleanupResults = null;
    if (cleanup) {
      // Clean up expired rate limit entries
      const rateLimitConfigs = getEnvironmentRateLimitConfig();
      let totalCleaned = 0;

      for (const config of Object.values(rateLimitConfigs)) {
        try {
          const keys = await redis.keys(`${config.prefix}:*`);

          for (const key of keys) {
            const data = await redis.get(key);
            if (data) {
              try {
                const parsed = JSON.parse(data);
                const now = Date.now();

                // Remove expired entries
                if (parsed.resetTime && now >= parsed.resetTime) {
                  await redis.del(key);
                  totalCleaned++;
                }
              } catch (parseError) {
                // Remove corrupted entries
                await redis.del(key);
                totalCleaned++;
              }
            }
          }
        } catch (error) {
          console.error(`Error cleaning up ${config.prefix}:`, error);
        }
      }

      cleanupResults = {
        entriesRemoved: totalCleaned,
        timestamp: new Date().toISOString(),
      };
    }

    // Get basic health status
    const configValidation = validateConfiguration();
    const redisHealth = {
      status: "healthy",
      latency: 0,
      error: null,
    };

    try {
      const start = Date.now();
      await redis.ping();
      redisHealth.latency = Date.now() - start;
    } catch (error) {
      redisHealth.status = "unhealthy";
      redisHealth.error = error instanceof Error ? error.message : "Unknown error";
    }

    const response = {
      status: configValidation.isValid && redisHealth.status === "healthy" ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      configuration: {
        isValid: configValidation.isValid,
        errors: configValidation.errors,
      },
      redis: redisHealth,
      ...(cleanupResults && { cleanup: cleanupResults }),
    };

    return new Response(JSON.stringify(response, null, detailed ? 2 : 0), {
      status: response.status === "healthy" ? 200 : 503,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Detailed health check failed:", error);

    return new Response(JSON.stringify({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}, "SENSITIVE"); // Use sensitive rate limiting for detailed health checks
