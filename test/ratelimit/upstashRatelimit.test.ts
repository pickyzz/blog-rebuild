import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit, getClientIdentifier, withUpstashRateLimit, RATE_LIMIT_CONFIGS } from "../../src/utils/ratelimit/upstashRatelimit";

// Mock Redis
vi.mock("@upstash/redis", () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    pipeline: vi.fn().mockReturnValue({
      exec: vi.fn(),
    }),
  })),
}));

// Mock @upstash/ratelimit
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: vi.fn().mockImplementation(() => ({
    limit: vi.fn(),
  })),
}));

describe("Rate Limiting Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("getClientIdentifier", () => {
    it("should extract API key from x-api-key header", () => {
      const request = new Request("https://example.com", {
        headers: { "x-api-key": "test-api-key-123" },
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toMatch(/^api_key_[a-f0-9]+$/);
    });

    it("should extract API key from Authorization header", () => {
      const request = new Request("https://example.com", {
        headers: { "authorization": "Bearer test-api-key-123" },
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toMatch(/^api_key_[a-f0-9]+$/);
    });

    it("should fall back to IP address when no API key", () => {
      const request = new Request("https://example.com", {
        headers: { "x-forwarded-for": "192.168.1.1" },
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe("ip_192.168.1.1");
    });

    it("should use x-real-ip when x-forwarded-for is not available", () => {
      const request = new Request("https://example.com", {
        headers: { "x-real-ip": "10.0.0.1" },
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe("ip_10.0.0.1");
    });

    it("should return unknown when no identifying headers", () => {
      const request = new Request("https://example.com");

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe("ip_unknown");
    });

    it("should handle multiple IPs in x-forwarded-for", () => {
      const request = new Request("https://example.com", {
        headers: { "x-forwarded-for": "203.0.113.1, 192.168.1.1, 10.0.0.1" },
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe("ip_203.0.113.1");
    });
  });

  describe("checkRateLimit", () => {
    beforeEach(() => {
      // Mock environment variables
      process.env.UPSTASH_REDIS_REST_URL = "https://test.redis.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    });

    it("should return success when within limits", async () => {
      const { Ratelimit } = await import("@upstash/ratelimit");
      const mockLimit = vi.mocked(Ratelimit).mock.instances[0];

      mockLimit.limit.mockResolvedValue({
        success: true,
        limit: 30,
        remaining: 29,
        reset: Date.now() + 60000,
      });

      const result = await checkRateLimit("test-identifier", "MODERATE");

      expect(result.success).toBe(true);
      expect(result.limit).toBe(30);
      expect(result.remaining).toBe(29);
      expect(result.reset).toBeInstanceOf(Date);
    });

    it("should return failure when limit exceeded", async () => {
      const { Ratelimit } = await import("@upstash/ratelimit");
      const mockLimit = vi.mocked(Ratelimit).mock.instances[0];

      mockLimit.limit.mockResolvedValue({
        success: false,
        limit: 30,
        remaining: 0,
        reset: Date.now() + 60000,
      });

      const result = await checkRateLimit("test-identifier", "MODERATE");

      expect(result.success).toBe(false);
      expect(result.limit).toBe(30);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("should fail open when rate limiting service fails", async () => {
      const { Ratelimit } = await import("@upstash/ratelimit");
      const mockLimit = vi.mocked(Ratelimit).mock.instances[0];

      mockLimit.limit.mockRejectedValue(new Error("Redis connection failed"));

      const result = await checkRateLimit("test-identifier", "MODERATE");

      expect(result.success).toBe(true);
      expect(result.limit).toBe(RATE_LIMIT_CONFIGS.MODERATE.max);
      expect(result.remaining).toBe(RATE_LIMIT_CONFIGS.MODERATE.max);
    });

    it("should throw error for invalid rate limit type", async () => {
      await expect(
        checkRateLimit("test-identifier", "INVALID" as any)
      ).rejects.toThrow("Invalid rate limit type: INVALID");
    });

    it("should use different configurations for different types", async () => {
      const { Ratelimit } = await import("@upstash/ratelimit");
      const mockLimit = vi.mocked(Ratelimit).mock.instances[0];

      mockLimit.limit.mockResolvedValue({
        success: true,
        limit: 5,
        remaining: 4,
        reset: Date.now() + 900000, // 15 minutes
      });

      const result = await checkRateLimit("test-identifier", "SENSITIVE");

      expect(result.success).toBe(true);
      expect(result.limit).toBe(5); // SENSITIVE limit
    });
  });

  describe("withUpstashRateLimit", () => {
    beforeEach(() => {
      // Mock environment variables
      process.env.UPSTASH_REDIS_REST_URL = "https://test.redis.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    });

    it("should call handler when rate limit allows", async () => {
      const { Ratelimit } = await import("@upstash/ratelimit");
      const mockLimit = vi.mocked(Ratelimit).mock.instances[0];

      mockLimit.limit.mockResolvedValue({
        success: true,
        limit: 30,
        remaining: 29,
        reset: Date.now() + 60000,
      });

      const mockHandler = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json" },
        })
      );

      const wrappedHandler = withUpstashRateLimit(mockHandler, "MODERATE");
      const mockContext = {
        request: new Request("https://example.com", {
          headers: { "x-forwarded-for": "192.168.1.1" },
        }),
      };

      const response = await wrappedHandler(mockContext);

      expect(mockHandler).toHaveBeenCalledWith(mockContext);
      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Limit")).toBe("30");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("29");
    });

    it("should return 429 when rate limit exceeded", async () => {
      const { Ratelimit } = await import("@upstash/ratelimit");
      const mockLimit = vi.mocked(Ratelimit).mock.instances[0];

      mockLimit.limit.mockResolvedValue({
        success: false,
        limit: 30,
        remaining: 0,
        reset: Date.now() + 60000,
      });

      const mockHandler = vi.fn();
      const wrappedHandler = withUpstashRateLimit(mockHandler, "MODERATE");
      const mockContext = {
        request: new Request("https://example.com", {
          headers: { "x-forwarded-for": "192.168.1.1" },
        }),
      };

      const response = await wrappedHandler(mockContext);

      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBeDefined();
      expect(response.headers.get("X-RateLimit-Limit")).toBe("30");
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toBe("Rate limit exceeded");
    });

    it("should handle handler errors gracefully", async () => {
      const { Ratelimit } = await import("@upstash/ratelimit");
      const mockLimit = vi.mocked(Ratelimit).mock.instances[0];

      mockLimit.limit.mockResolvedValue({
        success: true,
        limit: 30,
        remaining: 29,
        reset: Date.now() + 60000,
      });

      const mockHandler = vi.fn().mockRejectedValue(new Error("Handler error"));
      const wrappedHandler = withUpstashRateLimit(mockHandler, "MODERATE");
      const mockContext = {
        request: new Request("https://example.com", {
          headers: { "x-forwarded-for": "192.168.1.1" },
        }),
      };

      const response = await wrappedHandler(mockContext);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toBe("Internal server error");
    });
  });

  describe("RATE_LIMIT_CONFIGS", () => {
    it("should have all required rate limit configurations", () => {
      expect(RATE_LIMIT_CONFIGS).toHaveProperty("SENSITIVE");
      expect(RATE_LIMIT_CONFIGS).toHaveProperty("MODERATE");
      expect(RATE_LIMIT_CONFIGS).toHaveProperty("LENIENT");
      expect(RATE_LIMIT_CONFIGS).toHaveProperty("PUBLIC");
    });

    it("should have correct configuration values", () => {
      expect(RATE_LIMIT_CONFIGS.SENSITIVE.max).toBe(5);
      expect(RATE_LIMIT_CONFIGS.SENSITIVE.window).toBe("15 m");

      expect(RATE_LIMIT_CONFIGS.MODERATE.max).toBe(30);
      expect(RATE_LIMIT_CONFIGS.MODERATE.window).toBe("1 m");

      expect(RATE_LIMIT_CONFIGS.LENIENT.max).toBe(60);
      expect(RATE_LIMIT_CONFIGS.LENIENT.window).toBe("1 m");

      expect(RATE_LIMIT_CONFIGS.PUBLIC.max).toBe(100);
      expect(RATE_LIMIT_CONFIGS.PUBLIC.window).toBe("1 m");
    });
  });
});
