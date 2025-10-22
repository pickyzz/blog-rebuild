#!/usr/bin/env node

/**
 * Pre-build cache warming script
 * This script runs before build to warm up Redis cache with essential data
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load TypeScript modules using dynamic import with proper extension handling
async function loadModules() {
  try {
    // Try to load the transpiled JavaScript files first
    const { setCachedData, CacheKeys, isRedisHealthy } = await import(
      join(__dirname, '../dist/utils/cache/kv-cache.js')
    );

    const { getNotionPosts, getNotionUniqueTags } = await import(
      join(__dirname, '../dist/utils/getNotionPosts.js')
    );

    return { setCachedData, CacheKeys, isRedisHealthy, getNotionPosts, getNotionUniqueTags };
  } catch (error) {
    console.warn('⚠️  Could not load transpiled modules, falling back to direct execution...');

    // Fallback: use a simplified approach without TypeScript imports
    return {
      setCachedData: async () => {},
      CacheKeys: {
        allPosts: () => 'notion:posts:all',
        allTags: () => 'notion:tags:all',
        postBySlug: (slug) => `notion:post:${slug}`
      },
      isRedisHealthy: async () => false,
      getNotionPosts: async () => [],
      getNotionUniqueTags: async () => []
    };
  }
}

async function warmCache() {
  console.log('🚀 Starting Redis cache warm-up...');

  try {
    const modules = await loadModules();
    const { setCachedData, CacheKeys, isRedisHealthy, getNotionPosts, getNotionUniqueTags } = modules;

    // Check if Redis is healthy
    const redisHealthy = await isRedisHealthy();
    if (!redisHealthy) {
      console.warn('⚠️  Redis is not healthy or modules not loaded, skipping cache warm-up');
      console.log('💡 Tip: Make sure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set');
      process.exit(0);
    }

    console.log('✅ Redis is healthy, warming cache...');

    // Warm up posts cache
    console.log('📝 Warming posts cache...');
    const posts = await getNotionPosts();
    if (posts && posts.length > 0) {
      await setCachedData(CacheKeys.allPosts(), posts, 1800);
      console.log(`✅ Cached ${posts.length} posts`);
    }

    // Warm up tags cache
    console.log('🏷️  Warming tags cache...');
    const tags = await getNotionUniqueTags();
    if (tags && tags.length > 0) {
      await setCachedData(CacheKeys.allTags(), tags, 3600);
      console.log(`✅ Cached ${tags.length} tags`);
    }

    // Warm up individual post caches for recent posts (limit to 10 most recent)
    console.log('📄 Warming recent post caches...');
    const recentPosts = posts.slice(0, 10);
    for (const post of recentPosts) {
      if (post.data?.slug) {
        try {
          const postDetail = await getNotionPostBySlug(post.data.slug);
          if (postDetail) {
            await setCachedData(CacheKeys.postBySlug(post.data.slug), postDetail, 1800);
            console.log(`✅ Cached post: ${post.data.slug}`);
          }
        } catch (error) {
          console.warn(`⚠️  Failed to cache post ${post.data.slug}:`, error.message);
        }
      }
    }

    console.log('🎉 Redis cache warm-up completed successfully!');

  } catch (error) {
    console.error('❌ Redis cache warm-up failed:', error);
    console.log('💡 This is not critical - the build will continue with runtime caching');
    process.exit(0); // Exit with 0 to allow build to continue
  }
}

// Import getNotionPostBySlug dynamically to avoid circular dependencies
async function getNotionPostBySlug(slug) {
  try {
    const { getNotionPostBySlug: fetchPostBySlug } = await import(
      join(__dirname, '../dist/utils/getNotionPosts.js')
    );
    return fetchPostBySlug(slug);
  } catch (error) {
    console.warn(`⚠️  Could not load getNotionPostBySlug for ${slug}`);
    return null;
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  warmCache();
}

export default warmCache;
