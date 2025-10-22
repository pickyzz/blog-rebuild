// Cloudflare Workers KV Cache Implementation
// Alternative to Upstash Redis if you're using Cloudflare

export interface CloudflareKVCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<{ keys: string[] }>;
}

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

// Get KV namespace from environment
function getKVNamespace(): CloudflareKVCache {
  const kv = (globalThis as any).CLOUDFLARE_KV_NAMESPACE;
  if (!kv) {
    throw new Error("CLOUDFLARE_KV_NAMESPACE not available. Make sure you're running on Cloudflare Workers.");
  }
  return kv;
}

// Get cached data with fallback to fetch function
export async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_CONFIG.defaultTTL
): Promise<T | null> {
  try {
    const kv = getKVNamespace();

    // Try to get from cache first
    const cached = await kv.get(key);
    if (cached !== null) {
      console.log(`Cache hit for key: ${key}`);
      return JSON.parse(cached);
    }

    // Cache miss - fetch fresh data
    console.log(`Cache miss for key: ${key}, fetching fresh data`);
    const data = await fetcher();

    // Store in cache with TTL
    await kv.set(key, JSON.stringify(data), { expirationTtl: ttl });
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
    const kv = getKVNamespace();
    await kv.set(key, JSON.stringify(data), { expirationTtl: ttl });
    console.log(`Manually cached data for key: ${key}`);
  } catch (error) {
    console.error(`Failed to cache data for key ${key}:`, error);
  }
}

// Invalidate cache by key pattern
export async function invalidateCache(keyPattern: string): Promise<void> {
  try {
    const kv = getKVNamespace();
    const { keys } = await kv.list();
    const matchingKeys = keys.filter(key => key.includes(keyPattern.replace("*", "")));

    if (matchingKeys.length > 0) {
      await Promise.all(matchingKeys.map(key => kv.delete(key)));
      console.log(`Invalidated ${matchingKeys.length} cache keys matching: ${keyPattern}`);
    }
  } catch (error) {
    console.error(`Failed to invalidate cache pattern ${keyPattern}:`, error);
  }
}

// Invalidate specific cache key
export async function invalidateCacheKey(key: string): Promise<void> {
  try {
    const kv = getKVNamespace();
    await kv.delete(key);
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
    const kv = getKVNamespace();
    const { keys } = await kv.list();
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

// Health check for KV
export async function isKVHealthy(): Promise<boolean> {
  try {
    const kv = getKVNamespace();
    const testKey = "health:check";
    await kv.set(testKey, "ok", { expirationTtl: 10 });
    const result = await kv.get(testKey);
    await kv.delete(testKey);
    return result === "ok";
  } catch (error) {
    console.error("KV health check failed:", error);
    return false;
  }
}

// Fallback memory cache for when KV is not available
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

// Hybrid cache function that tries KV first, falls back to memory cache
export async function getHybridCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_CONFIG.defaultTTL
): Promise<T | null> {
  try {
    // Try Cloudflare KV first
    const kvResult = await getCachedData(key, fetcher, ttl);
    if (kvResult !== null) {
      return kvResult;
    }
  } catch (error) {
    console.warn("Cloudflare KV cache failed, trying memory cache:", error);
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
```

### **Option 3: File-based Cache (ไม่ต้องใช้บริการภายนอก)**

```typescript
// src/utils/cache/file-cache.ts
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const CACHE_DIR = join(process.cwd(), '.cache');

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true });
}

export async function getFileCache<T>(key: string): Promise<T | null> {
  try {
    const filePath = join(CACHE_DIR, `${key}.json`);
    if (!existsSync(filePath)) return null;

    const data = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(data);

    // Check if cache is still valid
    if (Date.now() < parsed.expiresAt) {
      return parsed.data;
    }

    // Remove expired cache
    require('fs').unlinkSync(filePath);
    return null;
  } catch (error) {
    console.error('File cache read error:', error);
    return null;
  }
}

export async function setFileCache<T>(
  key: string,
  data: T,
  ttl: number = 3600
): Promise<void> {
  try {
    const filePath = join(CACHE_DIR, `${key}.json`);
    const cacheData = {
      data,
      expiresAt: Date.now() + (ttl * 1000),
      cachedAt: Date.now()
    };

    writeFileSync(filePath, JSON.stringify(cacheData, null, 2));
  } catch (error) {
    console.error('File cache write error:', error);
  }
}
```

### **Option 4: ปรับปรุง ISR Strategy (ไม่ต้อง External Cache)**

```astro
---
// src/pages/index.astro - Enhanced ISR
import { getNotionPosts } from "@/utils/getNotionPosts";

// Use longer revalidation for better performance
export const prerender = true;
export const revalidate = 3600; // 1 hour instead of 30 minutes

// Add build-time cache warming
const posts = await getNotionPosts();

// Enhanced cache headers
if (Astro.response && Astro.response.headers) {
  Astro.response.headers.set(
    "cache-control",
    "public, max-age=3600, stale-while-revalidate=7200, s-maxage=3600"
  );

  // Add CDN cache headers
  Astro.response.headers.set(
    "CDN-Cache-Control",
    "public, max-age=3600, stale-while-revalidate=7200"
  );
}
---
```

## 🎯 **คำแนะนำของผม**

### **ถ้าอยากเก็บ Persistent Cache:**
**ใช้ Upstash Redis (Option 1)** - ฟรี 10,000 requests/day และยังให้บริการอยู่

### **ถ้าไม่อยากเสียเงิน:**
**ใช้ File-based Cache (Option 3)** + **Enhanced ISR (Option 4)**

### **ถ้าย้ายไป Cloudflare:**
**ใช้ Cloudflare Workers KV (Option 2)** - ฟรี 100,000 reads/day

## 🚀 **Setup สำหรับ Upstash Redis (แนะนำสูงสุด):**

1. **สร้าง Upstash Redis:**
   - ไปที่ https://console.upstash.com/
   - Create Database → Redis
   - เลือก region ที่ใกล้ผู้ใช้
   - Copy REST URL และ Token

2. **Environment Variables:**
   ```env
   UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-redis-token
   ```

3. **Deploy:**
   ```bash
   npm run build
   vercel --prod
   ```

4. **Test:**
   ```bash
   npm run cache:warm
   npm run cache:stats
   ```

อยากใช้ option ไหนครับ? ผมแนะนำ Upstash Redis เพราะ setup ง่ายและยังมี free tier ดีครับ 🚀
