/**
 * Cache Health Check Script
 * Checks cache configuration and provides status information
 */

// Load environment variables from root directory
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../..', '.env');

config({ path: envPath });

console.log('🏥 Checking cache health...\n');

async function checkHealth() {
  try {
    // Check environment variables
    console.log('🔧 Environment Variables:');
    console.log('  UPSTASH_REDIS_REST_URL:', process.env.UPSTASH_REDIS_REST_URL ? '✅ Set' : '❌ Missing');
    console.log('  UPSTASH_REDIS_REST_TOKEN:', process.env.UPSTASH_REDIS_REST_TOKEN ? '✅ Set' : '❌ Missing');
    console.log('  NOTION_KEY:', process.env.NOTION_KEY ? '✅ Set' : '❌ Missing');
    console.log('  DATABASE_ID:', process.env.DATABASE_ID ? '✅ Set' : '❌ Missing');

    // Check if Redis is configured
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      console.log('\n⚠️  Redis is not configured properly');
      console.log('💡 To fix:');
      console.log('1. Create .env file with:');
      console.log('   UPSTASH_REDIS_REST_URL=your_redis_url');
      console.log('   UPSTASH_REDIS_REST_TOKEN=your_redis_token');
      console.log('2. Get credentials from Upstash Redis console');
      console.log('3. Restart your development server');
      return;
    }

    // Try to connect to Redis
    console.log('\n🔄 Testing Redis connection...');
    const { Redis } = await import('@upstash/redis');

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // Test connection
    const testKey = 'health:check';
    await redis.set(testKey, 'ok', { ex: 10 });
    const result = await redis.get(testKey);
    await redis.del(testKey);

    if (result === 'ok') {
      console.log('✅ Redis connection successful');

      // Get basic stats
      try {
        const keys = await redis.keys('*');
        console.log(`📊 Cache Statistics:`);
        console.log(`  Total Keys: ${keys.length}`);
        console.log(`  Memory Usage: ~${(keys.length * 1024).toFixed(2)} bytes (estimated)`);

        if (keys.length === 0) {
          console.log('  Status: Empty - run warm cache script');
          console.log('  Command: npm run cache:warm:isr');
        } else if (keys.length < 50) {
          console.log('  Status: Light - good performance');
        } else if (keys.length < 200) {
          console.log('  Status: Moderate - optimal performance');
        } else {
          console.log('  Status: Heavy - consider cleanup');
          console.log('  Command: npm run cache:clear');
        }
      } catch (statsError) {
        console.log('⚠️  Could not fetch statistics (permission issue)');
      }

      console.log('\n🎉 Cache system is operational!');
    } else {
      console.log('❌ Redis connection failed');
    }

  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check if .env file exists');
    console.log('2. Verify environment variables are correct');
    console.log('3. Ensure Redis instance is running');
    console.log('4. Check network connection');
    console.log('5. Verify Upstash Redis credentials');
  }
}

checkHealth();
