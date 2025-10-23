/**
 * Rate Limit Configuration and Validation
 *
 * This module provides configuration management and validation
 * for the Upstash-based rate limiting system.
 */

// Rate limit configuration interface
export interface RateLimitConfig {
  window: string; // Time window (e.g., "1 m", "15 m", "1 h")
  max: number;    // Maximum requests per window
  prefix: string; // Redis key prefix
}

// Rate limit types
export type RateLimitType = "SENSITIVE" | "MODERATE" | "LENIENT" | "PUBLIC";

// Default rate limit configurations
export const DEFAULT_RATE_LIMIT_CONFIGS: Record<RateLimitType, RateLimitConfig> = {
  SENSITIVE: {
    window: "15 m", // 15 minutes
    max: 5,         // 5 requests per 15 minutes
    prefix: "rl_sensitive",
  },
  MODERATE: {
    window: "1 m",  // 1 minute
    max: 30,        // 30 requests per minute
    prefix: "rl_moderate",
  },
  LENIENT: {
    window: "1 m",  // 1 minute
    max: 60,        // 60 requests per minute
    prefix: "rl_lenient",
  },
  PUBLIC: {
    window: "1 m",  // 1 minute
    max: 100,       // 100 requests per minute
    prefix: "rl_public",
  },
};

// Environment configuration interface
export interface RateLimitEnvConfig {
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  RATE_LIMIT_OVERRIDE?: Partial<Record<RateLimitType, Partial<RateLimitConfig>>>;
  RATE_LIMIT_DEBUG?: boolean;
}

/**
 * Validate environment variables for rate limiting
 */
export function validateRateLimitEnv(): {
  isValid: boolean;
  errors: string[];
  config: RateLimitEnvConfig;
} {
  const errors: string[] = [];

  // Check required environment variables
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    errors.push("UPSTASH_REDIS_REST_URL is required");
  }

  if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
    errors.push("UPSTASH_REDIS_REST_TOKEN is required");
  }

  // Validate URL format
  if (process.env.UPSTASH_REDIS_REST_URL) {
    try {
      new URL(process.env.UPSTASH_REDIS_REST_URL);
    } catch {
      errors.push("UPSTASH_REDIS_REST_URL must be a valid URL");
    }
  }

  // Parse optional overrides
  let rateLimitOverride: Partial<Record<RateLimitType, Partial<RateLimitConfig>>> = {};
  if (process.env.RATE_LIMIT_OVERRIDE) {
    try {
      rateLimitOverride = JSON.parse(process.env.RATE_LIMIT_OVERRIDE);
    } catch {
      errors.push("RATE_LIMIT_OVERRIDE must be valid JSON");
    }
  }

  const config: RateLimitEnvConfig = {
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || "",
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    RATE_LIMIT_OVERRIDE: rateLimitOverride,
    RATE_LIMIT_DEBUG: process.env.RATE_LIMIT_DEBUG === "true",
  };

  return {
    isValid: errors.length === 0,
    errors,
    config,
  };
}

/**
 * Get final rate limit configuration with overrides applied
 */
export function getRateLimitConfig(): Record<RateLimitType, RateLimitConfig> {
  const { config: envConfig } = validateRateLimitEnv();
  const finalConfig = { ...DEFAULT_RATE_LIMIT_CONFIGS };

  // Apply environment overrides
  if (envConfig.RATE_LIMIT_OVERRIDE) {
    for (const [type, override] of Object.entries(envConfig.RATE_LIMIT_OVERRIDE)) {
      const rateLimitType = type as RateLimitType;
      if (finalConfig[rateLimitType]) {
        finalConfig[rateLimitType] = {
          ...finalConfig[rateLimitType],
          ...override,
        };
      }
    }
  }

  return finalConfig;
}

/**
 * Validate a rate limit configuration
 */
export function validateRateLimitConfig(config: RateLimitConfig): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate window format
  const windowPattern = /^(\d+)\s*(s|m|h|d)$/;
  if (!windowPattern.test(config.window)) {
    errors.push("Window must be in format like '1 m', '15 m', '1 h', '1 d'");
  }

  // Validate max requests
  if (!Number.isInteger(config.max) || config.max <= 0) {
    errors.push("Max requests must be a positive integer");
  }

  // Validate prefix
  if (!config.prefix || typeof config.prefix !== "string") {
    errors.push("Prefix must be a non-empty string");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Convert window string to milliseconds
 */
export function windowToMs(window: string): number {
  const match = window.match(/^(\d+)\s*(s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid window format: ${window}`);
  }

  const [, amount, unit] = match;
  const value = parseInt(amount, 10);

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Invalid time unit: ${unit}`);
  }
}

/**
 * Get rate limit configuration for development environment
 */
export function getDevRateLimitConfig(): Record<RateLimitType, RateLimitConfig> {
  return {
    SENSITIVE: {
      ...DEFAULT_RATE_LIMIT_CONFIGS.SENSITIVE,
      window: "1 m", // Shorter window for development
      max: 10,       // More requests for development
    },
    MODERATE: {
      ...DEFAULT_RATE_LIMIT_CONFIGS.MODERATE,
      window: "1 m",
      max: 100,      // Much higher for development
    },
    LENIENT: {
      ...DEFAULT_RATE_LIMIT_CONFIGS.LENIENT,
      window: "1 m",
      max: 200,      // Much higher for development
    },
    PUBLIC: {
      ...DEFAULT_RATE_LIMIT_CONFIGS.PUBLIC,
      window: "1 m",
      max: 500,      // Much higher for development
    },
  };
}

/**
 * Get rate limit configuration based on environment
 */
export function getEnvironmentRateLimitConfig(): Record<RateLimitType, RateLimitConfig> {
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    return getDevRateLimitConfig();
  }

  return getRateLimitConfig();
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  isValid: boolean;
  environment: string;
  redis: {
    url: boolean;
    token: boolean;
  };
  rateLimits: Record<RateLimitType, {
    isValid: boolean;
    errors: string[];
  }>;
  errors: string[];
}

/**
 * Comprehensive configuration validation
 */
export function validateConfiguration(): ConfigValidationResult {
  const errors: string[] = [];
  const envValidation = validateRateLimitEnv();
  const environment = process.env.NODE_ENV || "unknown";

  // Validate Redis configuration
  const redis = {
    url: !!process.env.UPSTASH_REDIS_REST_URL,
    token: !!process.env.UPSTASH_REDIS_REST_TOKEN,
  };

  if (!redis.url) errors.push("Redis URL is not configured");
  if (!redis.token) errors.push("Redis token is not configured");

  // Validate rate limit configurations
  const configs = getEnvironmentRateLimitConfig();
  const rateLimits: Record<RateLimitType, { isValid: boolean; errors: string[] }> = {} as any;

  for (const [type, config] of Object.entries(configs)) {
    const validation = validateRateLimitConfig(config);
    rateLimits[type as RateLimitType] = validation;
    if (!validation.isValid) {
      errors.push(`Rate limit ${type}: ${validation.errors.join(", ")}`);
    }
  }

  return {
    isValid: errors.length === 0 && envValidation.isValid,
    environment,
    redis,
    rateLimits,
    errors: [...errors, ...envValidation.errors],
  };
}

/**
 * Print configuration status (for debugging)
 */
export function printConfigurationStatus(): void {
  const validation = validateConfiguration();

  console.log("\n🔧 Rate Limit Configuration Status");
  console.log("=".repeat(50));
  console.log(`🌍 Environment: ${validation.environment}`);
  console.log(`✅ Overall Valid: ${validation.isValid}`);

  console.log("\n📊 Redis Configuration:");
  console.log(`  URL: ${validation.redis.url ? "✅" : "❌"}`);
  console.log(`  Token: ${validation.redis.token ? "✅" : "❌"}`);

  console.log("\n🚦 Rate Limit Configurations:");
  for (const [type, config] of Object.entries(validation.rateLimits)) {
    console.log(`  ${type}: ${config.isValid ? "✅" : "❌"}`);
    if (!config.isValid) {
      config.errors.forEach(error => {
        console.log(`    - ${error}`);
      });
    }
  }

  if (validation.errors.length > 0) {
    console.log("\n❌ Errors:");
    validation.errors.forEach(error => console.log(`  - ${error}`));
  }

  console.log("=".repeat(50));
}
