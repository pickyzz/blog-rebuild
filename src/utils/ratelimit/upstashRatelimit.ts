import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import {
  getEnvironmentRateLimitConfig,
  validateConfiguration,
  type RateLimitType,
  type RateLimitConfig
} from "./config";

// Validate configuration on import
const configValidation = validateConfiguration();
if (!configValidation.isValid) {
  console.error("❌ Rate limit configuration is invalid:", configValidation.errors);
}

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Get rate limit configurations based on environment
export const RATE_LIMIT_CONFIGS = getEnvironmentRateLimitConfig();

// Pre-configured rate limiters
const rateLimiters: Record<RateLimitType, Ratelimit> = {
  SENSITIVE: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMIT_CONFIGS.SENSITIVE.max, `${RATE_LIMIT_CONFIGS.SENSITIVE.window}` as any),
    analytics: true,
    prefix: RATE_LIMIT_CONFIGS.SENSITIVE.prefix,
  }),
  MODERATE: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMIT_CONFIGS.MODERATE.max, `${RATE_LIMIT_CONFIGS.MODERATE.window}` as any),
    analytics: true,
    prefix: RATE_LIMIT_CONFIGS.MODERATE.prefix,
  }),
  LENIENT: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMIT_CONFIGS.LENIENT.max, `${RATE_LIMIT_CONFIGS.LENIENT.window}` as any),
    analytics: true,
    prefix: RATE_LIMIT_CONFIGS.LENIENT.prefix,
  }),
  PUBLIC: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMIT_CONFIGS.PUBLIC.max, `${RATE_LIMIT_CONFIGS.PUBLIC.window}` as any),
    analytics: true,
    prefix: RATE_LIMIT_CONFIGS.PUBLIC.prefix,
  }),
};

// Type definitions
export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
};

/**
 * Check rate limit for a given identifier and type
 * @param identifier - Unique identifier (IP address, API key, user ID, etc.)
 * @param type - Type of rate limit to apply
 * @returns Rate limit result
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimitType = "MODERATE"
): Promise<RateLimitResult> {
  const ratelimit = rateLimiters[type];

  if (!ratelimit) {
    throw new Error(`Invalid rate limit type: ${type}`);
  }

  try {
    const result = await ratelimit.limit(identifier);

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: new Date(result.reset),
      retryAfter: result.success ? undefined : Math.ceil((result.reset - Date.now()) / 1000),
    };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    // Fail open - allow the request if rate limiting fails
    const config = RATE_LIMIT_CONFIGS[type];
    return {
      success: true,
      limit: config.max,
      remaining: config.max,
      reset: new Date(Date.now() + 60 * 1000),
    };
  }
}

/**
 * Get client identifier from request
 * Uses X-Forwarded-For header for IP, or API key if available
 */
export function getClientIdentifier(request: Request): string {
  // Try to get API key first (for authenticated requests)
  const apiKey =
    request.headers.get("x-api-key") ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (apiKey) {
    // Hash the API key for privacy
    return `api_key_${hashString(apiKey)}`;
  }

  // Fall back to IP address
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";

  return `ip_${clientIp}`;
}

/**
 * Simple hash function for identifiers
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Create rate-limited API route wrapper for Astro
 */
export function withUpstashRateLimit(
  handler: (context: any) => Promise<Response>,
  type: RateLimitType = "MODERATE"
) {
  return async (context: any) => {
    const identifier = getClientIdentifier(context.request);
    const rateLimitResult = await checkRateLimit(identifier, type);

    // Set rate limit headers
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-RateLimit-Limit": rateLimitResult.limit.toString(),
      "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
      "X-RateLimit-Reset": rateLimitResult.reset.toISOString(),
    });

    if (!rateLimitResult.success) {
      headers.set("Retry-After", rateLimitResult.retryAfter?.toString() || "60");

      return new Response(
        JSON.stringify({
          success: false,
          message: "Rate limit exceeded",
          retryAfter: rateLimitResult.retryAfter,
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          reset: rateLimitResult.reset,
        }),
        {
          status: 429,
          headers,
        }
      );
    }

    // Execute the handler
    try {
      const response = await handler(context);

      // Add rate limit headers to successful response
      if (response.headers) {
        response.headers.set("X-RateLimit-Limit", rateLimitResult.limit.toString());
        response.headers.set("X-RateLimit-Remaining", rateLimitResult.remaining.toString());
        response.headers.set("X-RateLimit-Reset", rateLimitResult.reset.toISOString());
      }

      return response;
    } catch (error) {
      console.error("API handler error:", error);

      return new Response(
        JSON.stringify({
          success: false,
          message: "Internal server error",
        }),
        {
          status: 500,
          headers,
        }
      );
    }
  };
}

/**
 * Rate limit middleware for specific endpoints
 */
export const rateLimitMiddleware = {
  search: (handler: any) => withUpstashRateLimit(handler, "MODERATE"),
  api: (handler: any) => withUpstashRateLimit(handler, "LENIENT"),
  sensitive: (handler: any) => withUpstashRateLimit(handler, "SENSITIVE"),
  public: (handler: any) => withUpstashRateLimit(handler, "PUBLIC"),
};

/**
 * Get rate limit analytics (for monitoring)
 */
export async function getRateLimitAnalytics(type: RateLimitType) {
  try {
    const ratelimit = rateLimiters[type];
    // Note: Upstash Ratelimit analytics might require additional configuration
    // This is a placeholder for future analytics implementation
    return {
      type,
      config: RATE_LIMIT_CONFIGS[type],
      status: "enabled",
    };
  } catch (error) {
    console.error("Failed to get rate limit analytics:", error);
    return null;
  }
}
