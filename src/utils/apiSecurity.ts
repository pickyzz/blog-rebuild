import type { APIRoute } from "astro";

// Rate limiting configuration
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean; // Skip rate limiting for successful requests
  skipFailedRequests?: boolean; // Skip rate limiting for failed requests
}

// Rate limit store (in-memory for serverless environments)
// In production, consider using Redis or external database
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Default rate limit configurations
export const RATE_LIMITS = {
  // Strict limits for sensitive operations
  SENSITIVE: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 requests per 15 minutes
  },
  // Moderate limits for search and image operations
  MODERATE: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
  },
  // Lenient limits for general API access
  LENIENT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  },
} as const;

/**
 * Rate limiting utility for API routes
 * @param request - The incoming request
 * @param config - Rate limit configuration
 * @returns Object with success status and remaining requests info
 */
export function checkRateLimit(
  request: Request,
  config: RateLimitConfig
): {
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
} {
  // Get client identifier (IP address or API key)
  const clientId = getClientIdentifier(request);
  const now = Date.now();

  // Get or create rate limit entry
  let entry = rateLimitStore.get(clientId);

  if (!entry || now > entry.resetTime) {
    // Create new entry or reset expired entry
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(clientId, entry);

  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Get client identifier from request
 * Uses X-Forwarded-For header for IP, or API key if available
 */
function getClientIdentifier(request: Request): string {
  // Try to get API key first (for authenticated requests)
  const apiKey =
    request.headers.get("x-api-key") ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (apiKey) {
    // Hash the API key for privacy (simple hash for demo)
    return `api_key_${simpleHash(apiKey)}`;
  }

  // Fall back to IP address
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const clientIp = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";

  return `ip_${clientIp}`;
}

/**
 * Simple hash function for API keys (not cryptographically secure)
 * In production, use proper hashing
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Clean up expired rate limit entries periodically
 * Call this in background or scheduled job
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Create rate-limited API route wrapper
 */
export function withRateLimit(
  handler: APIRoute,
  config: RateLimitConfig
): APIRoute {
  return async context => {
    const rateLimitResult = checkRateLimit(context.request, config);

    if (!rateLimitResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Rate limit exceeded",
          retryAfter: rateLimitResult.retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": rateLimitResult.retryAfter?.toString() || "60",
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": new Date(
              rateLimitResult.resetTime
            ).toISOString(),
          },
        }
      );
    }

    // Add rate limit headers to successful response
    const response = await handler(context);

    // Clone response to add headers
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    newResponse.headers.set(
      "X-RateLimit-Remaining",
      rateLimitResult.remaining.toString()
    );
    newResponse.headers.set(
      "X-RateLimit-Reset",
      new Date(rateLimitResult.resetTime).toISOString()
    );

    return newResponse;
  };
}
