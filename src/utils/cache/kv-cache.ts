import { Redis } from "@upstash/redis";

// Initialize Upstash Redis
const redis = new Redis({
  url: import.meta.env.UPSTASH_REDIS_REST_URL || "",
  token: import.meta.env.UPSTASH_REDIS_REST_TOKEN || "",
});

// Cache configuration
const CACHE_CONFIG = {
  defaultTTL: 3600, // 1 hour in seconds
  postsTTL: 1800, // 30 minutes for posts
  tagsTTL: 7200, // 2 hours for tags
  imagesTTL: 86400, // 24 hours for images
};

// Cache key generators
export const CacheKeys = {
  allPosts: () => "notion:posts:all",
  postBySlug: (slug: string) => `notion:post:${slug}`,
  postsByTag: (tag: string) => `notion:posts:tag:${tag}`,
  allTags: () => "notion:tags:all",
  ogImage: (slug: string) => `og:image:${slug}`,
};

// Get cached data with fallback to fetch function
export async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_CONFIG.defaultTTL
): Promise<T | null> {
  try {
    // Try to get from cache first
    const cached = await redis.get<T>(key);
    if (cached !== null) {
      console.log(`Cache hit for key: ${key}`);
      return cached;
    }

    // Cache miss - fetch fresh data
    console.log(`Cache miss for key: ${key}, fetching fresh data`);
    const data = await fetcher();

    // Store in cache with TTL
    await redis.set(key, data, { ex: ttl });
    console.log(`Cached data for key: ${key} with TTL: ${ttl}s`);

    return data;
  } catch (error) {
    console.error(`Cache error for key ${key}:`, error);
    // Fallback to direct fetch if cache fails
    return await fetcher();
  }
}

// Set cache data manually
export async function setCachedData<T>(
  key: string,
  data: T,
  ttl: number = CACHE_CONFIG.defaultTTL
): Promise<void> {
  try {
    await redis.set(key, data, { ex: ttl });
    console.log(`Manually cached data for key: ${key}`);
  } catch (error) {
    console.error(`Failed to cache data for key ${key}:`, error);
  }
}

// Invalidate cache by key pattern
export async function invalidateCache(keyPattern: string): Promise<void> {
  try {
    const keys = await redis.keys(keyPattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(
        `Invalidated ${keys.length} cache keys matching: ${keyPattern}`
      );
    }
  } catch (error) {
    console.error(`Failed to invalidate cache pattern ${keyPattern}:`, error);
  }
}

// Invalidate specific cache key
export async function invalidateCacheKey(key: string): Promise<void> {
  try {
    await redis.del(key);
    console.log(`Invalidated cache key: ${key}`);
  } catch (error) {
    console.error(`Failed to invalidate cache key ${key}:`, error);
  }
}

// Get cache statistics (for debugging)
export async function getCacheStats(): Promise<{
  totalKeys: number;
  memoryUsage: string;
}> {
  try {
    const keys = await redis.keys("*");
    return {
      totalKeys: keys.length,
      memoryUsage: `${(keys.length * 1024).toFixed(2)} bytes (estimated)`,
    };
  } catch (error) {
    console.error("Failed to get cache stats:", error);
    return {
      totalKeys: 0,
      memoryUsage: "0 bytes",
    };
  }
}

// Health check for Redis
export async function isRedisHealthy(): Promise<boolean> {
  try {
    const testKey = "health:check";
    await redis.set(testKey, "ok", { ex: 10 });
    const result = await redis.get(testKey);
    await redis.del(testKey);
    return result === "ok";
  } catch (error) {
    console.error("Redis health check failed:", error);
    return false;
  }
}

// Fallback memory cache for when Redis is not available
const memoryCache = new Map<
  string,
  { data: any; timestamp: number; ttl: number }
>();

function isMemoryCacheValid(entry: {
  timestamp: number;
  ttl: number;
}): boolean {
  return Date.now() - entry.timestamp < entry.ttl * 1000;
}

export function getMemoryCache<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (entry && isMemoryCacheValid(entry)) {
    return entry.data;
  }
  memoryCache.delete(key);
  return null;
}

export function setMemoryCache<T>(
  key: string,
  data: T,
  ttl: number = CACHE_CONFIG.defaultTTL
): void {
  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  });
}

// Hybrid cache function that tries Redis first, falls back to memory cache
export async function getHybridCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_CONFIG.defaultTTL
): Promise<T | null> {
  try {
    // Try Redis first
    const redisResult = await getCachedData(key, fetcher, ttl);
    if (redisResult !== null) {
      return redisResult;
    }
  } catch (error) {
    console.warn("Redis cache failed, trying memory cache:", error);
  }

  // Fallback to memory cache
  const memoryResult = getMemoryCache<T>(key);
  if (memoryResult !== null) {
    return memoryResult;
  }

  // Fetch fresh data and cache in memory
  try {
    const data = await fetcher();
    setMemoryCache(key, data, ttl);
    return data;
  } catch (error) {
    console.error("Failed to fetch fresh data:", error);
    return null;
  }
}
