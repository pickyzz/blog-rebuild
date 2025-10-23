/**
 * Cache Clear Script
 * Safely clears all Notion-related cache entries
 */

// Load environment variables from root directory
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../..', '.env');

config({ path: envPath });

import { invalidateCache, invalidateCacheKey, CacheKeys } from '../../src/utils/cache/kv-cache.ts';

console.log('🗑️  Preparing to clear cache...\n');

async function clearCache() {
  try {
    console.log('⚠️  WARNING: This will clear all Notion cache entries');
    console.log('This may temporarily slow down your website.\n');

    // Clear all Notion-related cache
    console.log('🔄 Clearing Notion cache...');
    await invalidateCache('notion:*');
    console.log('✅ Cleared all Notion cache entries');

    // Clear specific cache keys
    console.log('\n🔄 Clearing specific cache keys...');
    await invalidateCacheKey(CacheKeys.allPosts());
    await invalidateCacheKey(CacheKeys.allTags());
    console.log('✅ Cleared posts and tags cache');

    console.log('\n🎉 Cache cleared successfully!');
    console.log('\n📝 NEXT STEPS:');
    console.log('1. Your website may be slower initially');
    console.log('2. Cache will rebuild automatically on first visits');
    console.log('3. Run warm cache script for optimal performance:');
    console.log('   npm run cache:warm:isr');

  } catch (error) {
    console.error('❌ Failed to clear cache:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check Redis connection: npm run cache:health');
    console.log('2. Verify environment variables');
    console.log('3. Ensure Redis instance is running');
  }
}

clearCache();
