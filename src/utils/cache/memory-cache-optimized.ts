// Optimized Memory Cache - No external services required
// Enhanced caching strategy for Vercel Edge Functions

// Cache configuration with different TTLs
const CACHE_CONFIG = {
  defaultTTL: 1800, // 30 minutes in seconds
  postsTTL: 1800,   // 30 minutes for posts
  tagsTTL: 3600,    // 1 hour for tags
  imagesTTL: 86400, // 24 hours for images
} as const;

// Cache key generators
export const CacheKeys = {
  allPosts: () => "notion:posts:all",
  postBySlug: (slug: string) => `notion:post:${slug}`,
  postsByTag: (tag: string) => `notion:posts:tag:${tag}`,
  allTags: () => "notion:tags:all",
  ogImage: (slug: string) => `og:image:${slug}`,
};

// Enhanced cache entry with metadata
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  lastAccessed: number;
}

// Memory cache with LRU-like behavior
class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize = 100; // Maximum number of entries
  private cleanupInterval = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Start periodic cleanup
    if (typeof setInterval !== "undefined") {
      setInterval(() => this.cleanup(), this.cleanupInterval);
    }
  }

  // Get data from cache
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if cache is still valid
    if (Date.now() - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    // Update access metadata
    entry.hits++;
    entry.lastAccessed = Date.now();

    console.log(`[CACHE HIT] ${key} (hits: ${entry.hits})`);
    return entry.data;
  }

  // Set data in cache
  set<T>(key: string, data: T, ttl: number = CACHE_CONFIG.defaultTTL): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLeastUsed();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0,
      lastAccessed: Date.now(),
    };

    this.cache.set(key, entry);
    console.log(`[CACHE SET] ${key} (TTL: ${ttl}s)`);
  }

  // Delete specific key
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`[CACHE DELETE] ${key}`);
    }
    return deleted;
  }

  // Clear all cache
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[CACHE CLEAR] ${size} entries removed`);
  }

  // Get cache statistics
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; hits: number; age: number }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      hits: entry.hits,
      age: Date.now() - entry.timestamp,
    }));

    const totalHits = entries.reduce((sum, e) => sum + e.hits, 0);
    const hitRate = totalHits > 0 ? totalHits / entries.length : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: Math.round(hitRate * 100) / 100,
      entries: entries.sort((a, b) => b.hits - a.hits).slice(0, 10),
    };
  }

  // Remove expired entries
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[CACHE CLEANUP] Removed ${removed} expired entries`);
    }
  }

  // Evict least used entries
  private evictLeastUsed(): void {
    let leastUsedKey = "";
    let leastAccessed = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < leastAccessed) {
        leastAccessed = entry.lastAccessed;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
      console.log(`[CACHE EVICT] ${leastUsedKey} (least used)`);
    }
  }

  // Invalidate by pattern
  invalidatePattern(pattern: string): number {
    let removed = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        removed++;
      }
    }
    console.log(`[CACHE INVALIDATE] ${removed} entries matching "${pattern}"`);
    return removed;
  }
}

// Global cache instance
const memoryCache = new MemoryCache();

// Public API functions
export async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_CONFIG.defaultTTL
): Promise<T | null> {
  // Try cache first
  const cached = memoryCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - fetch fresh data
  console.log(`[CACHE MISS] ${key}, fetching fresh data`);
  try {
    const data = await fetcher();
    memoryCache.set(key, data, ttl);
    return data;
  } catch (error) {
    console.error(`[CACHE ERROR] Failed to fetch data for ${key}:`, error);
    return null;
  }
}

// Set cache data manually
export function setCachedData<T>(
  key: string,
  data: T,
  ttl: number = CACHE_CONFIG.defaultTTL
): void {
  memoryCache.set(key, data, ttl);
}

// Invalidate cache by key
export function invalidateCacheKey(key: string): boolean {
  return memoryCache.delete(key);
}

// Invalidate cache by pattern
export function invalidateCache(pattern: string): number {
  return memoryCache.invalidatePattern(pattern);
}

// Get cache statistics
export function getCacheStats() {
  return memoryCache.getStats();
}

// Clear all cache
export function clearAllCache(): void {
  memoryCache.clear();
}

// Health check
export function isCacheHealthy(): boolean {
  const stats = memoryCache.getStats();
  return stats.size < stats.maxSize;
}

// Enhanced cache with retry logic
export async function getCachedDataWithRetry<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_CONFIG.defaultTTL,
  maxRetries: number = 2
): Promise<T | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await getCachedData(key, fetcher, ttl);
    } catch (error) {
      console.error(`[CACHE RETRY] Attempt ${attempt + 1} failed for ${key}:`, error);

      if (attempt === maxRetries) {
        // Last attempt failed, clear cache and try once more
        memoryCache.delete(key);
        try {
          return await fetcher();
        } catch (finalError) {
          console.error(`[CACHE FAILED] All attempts failed for ${key}:`, finalError);
          return null;
        }
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  return null;
}

// Preload common data - disabled in SSG mode
// Preload common data - disabled in SSG mode
export async function preloadCache(): Promise<void> {
  console.log('[CACHE PRELOAD] Skipping preload in SSG mode');

  // In SSG mode, we don't need to preload cache
  // All content is available via content collections
  return;
}

// Export cache instance for advanced usage
export { memoryCache };
