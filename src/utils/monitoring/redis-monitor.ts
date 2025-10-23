import { Redis } from "@upstash/redis";

// Free Plan Redis Monitoring (10k requests/day limit)
export class RedisMonitor {
  private redis: Redis;
  private dailyRequests = 0;
  private lastReset = Date.now();
  private readonly DAILY_LIMIT = 10000;
  private readonly WARNING_THRESHOLD = 8000; // 80% of limit

  constructor(redis: Redis) {
    this.redis = redis;
  }

  // Track Redis usage with simple in-memory counter
  async trackRequest(): Promise<{ allowed: boolean; remaining: number; nearLimit: boolean }> {
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    // Reset counter daily
    if (now - this.lastReset > dayInMs) {
      this.dailyRequests = 0;
      this.lastReset = now;
    }

    this.dailyRequests++;
    const remaining = this.DAILY_LIMIT - this.dailyRequests;
    const nearLimit = this.dailyRequests > this.WARNING_THRESHOLD;

    // Log warning when approaching limit
    if (nearLimit && this.dailyRequests % 100 === 0) {
      console.warn(`[REDIS MONITOR] High usage detected: ${this.dailyRequests}/${this.DAILY_LIMIT} requests used`);
    }

    // Block requests if limit exceeded (emergency fallback)
    if (this.dailyRequests >= this.DAILY_LIMIT) {
      console.error(`[REDIS MONITOR] Daily limit exceeded: ${this.dailyRequests}/${this.DAILY_LIMIT}`);
      return { allowed: false, remaining: 0, nearLimit: true };
    }

    return { allowed: true, remaining, nearLimit };
  }

  // Safe Redis operations with monitoring
  async safeGet<T>(key: string): Promise<T | null> {
    const tracking = await this.trackRequest();
    if (!tracking.allowed) {
      console.warn(`[REDIS MONITOR] Skipping Redis GET due to limit: ${key}`);
      return null;
    }

    try {
      return await this.redis.get<T>(key);
    } catch (error) {
      console.error(`[REDIS MONITOR] Redis GET failed for ${key}:`, error);
      return null;
    }
  }

  async safeSet(key: string, value: any, options?: { ex?: number }): Promise<boolean> {
    const tracking = await this.trackRequest();
    if (!tracking.allowed) {
      console.warn(`[REDIS MONITOR] Skipping Redis SET due to limit: ${key}`);
      return false;
    }

    try {
      await this.redis.set(key, value, options);
      return true;
    } catch (error) {
      console.error(`[REDIS MONITOR] Redis SET failed for ${key}:`, error);
      return false;
    }
  }

  async safeDel(key: string): Promise<boolean> {
    const tracking = await this.trackRequest();
    if (!tracking.allowed) {
      console.warn(`[REDIS MONITOR] Skipping Redis DEL due to limit: ${key}`);
      return false;
    }

    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error(`[REDIS MONITOR] Redis DEL failed for ${key}:`, error);
      return false;
    }
  }

  // Get current usage stats
  getStats() {
    return {
      used: this.dailyRequests,
      limit: this.DAILY_LIMIT,
      remaining: Math.max(0, this.DAILY_LIMIT - this.dailyRequests),
      percentage: Math.round((this.dailyRequests / this.DAILY_LIMIT) * 100),
      nearLimit: this.dailyRequests > this.WARNING_THRESHOLD
    };
  }
}

// Singleton instance for the app
let monitorInstance: RedisMonitor | null = null;

export function getRedisMonitor(redis: Redis): RedisMonitor {
  if (!monitorInstance) {
    monitorInstance = new RedisMonitor(redis);
  }
  return monitorInstance;
}
