#!/usr/bin/env node

/**
 * Rate Limit Monitoring Script
 *
 * This script monitors the rate limiting status and provides analytics
 * for the Upstash-based rate limiting system.
 */

import { Redis } from "@upstash/redis";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load environment variables
const loadEnv = () => {
  try {
    const envPath = resolve(process.cwd(), ".env");
    const envContent = readFileSync(envPath, "utf8");

    envContent.split("\n").forEach(line => {
      const [key, ...values] = line.split("=");
      if (key && !key.startsWith("#") && values.length > 0) {
        process.env[key.trim()] = values.join("=").trim();
      }
    });
  } catch (error) {
    console.error("Error loading .env file:", error.message);
    process.exit(1);
  }
};

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Rate limit configurations
const RATE_LIMIT_CONFIGS = {
  SENSITIVE: { window: "15 m", max: 5, prefix: "rl_sensitive" },
  MODERATE: { window: "1 m", max: 30, prefix: "rl_moderate" },
  LENIENT: { window: "1 m", max: 60, prefix: "rl_lenient" },
  PUBLIC: { window: "1 m", max: 100, prefix: "rl_public" },
};

/**
 * Get rate limit statistics for a specific type
 */
async function getRateLimitStats(type) {
  const config = RATE_LIMIT_CONFIGS[type];
  if (!config) {
    throw new Error(`Invalid rate limit type: ${type}`);
  }

  try {
    // Get all keys for this rate limit type
    const keys = await redis.keys(`${config.prefix}:*`);

    if (keys.length === 0) {
      return {
        type,
        config,
        totalEntries: 0,
        activeEntries: 0,
        blockedEntries: 0,
        averageUsage: 0,
      };
    }

    // Get data for each key
    const pipeline = redis.pipeline();
    keys.forEach(key => {
      pipeline.get(key);
    });

    const results = await pipeline.exec();
    let totalUsage = 0;
    let blockedCount = 0;
    let activeCount = 0;

    results.forEach(([err, data]) => {
      if (!err && data) {
        try {
          const parsed = JSON.parse(data);
          totalUsage += parsed.count || 0;

          if (parsed.count >= config.max) {
            blockedCount++;
          }

          // Check if entry is still valid (within window)
          const now = Date.now();
          if (parsed.resetTime && now < parsed.resetTime) {
            activeCount++;
          }
        } catch (parseError) {
          // Ignore parsing errors
        }
      }
    });

    return {
      type,
      config,
      totalEntries: keys.length,
      activeEntries: activeCount,
      blockedEntries: blockedCount,
      averageUsage: activeCount > 0 ? Math.round(totalUsage / activeCount) : 0,
    };
  } catch (error) {
    console.error(`Error getting stats for ${type}:`, error);
    return {
      type,
      config,
      error: error.message,
    };
  }
}

/**
 * Get Redis health and usage information
 */
async function getRedisHealth() {
  try {
    const info = await redis.info();
    const keyspace = await redis.info("keyspace");

    return {
      status: "healthy",
      info: {
        version: info.match(/redis_version:([^\r\n]+)/)?.[1] || "unknown",
        uptime: info.match(/uptime_in_seconds:([^\r\n]+)/)?.[1] || "unknown",
        connected_clients: info.match(/connected_clients:([^\r\n]+)/)?.[1] || "unknown",
        used_memory: info.match(/used_memory_human:([^\r\n]+)/)?.[1] || "unknown",
      },
      keyspace: keyspace || "no keyspace data",
    };
  } catch (error) {
    return {
      status: "error",
      error: error.message,
    };
  }
}

/**
 * Clean up expired rate limit entries
 */
async function cleanupExpiredEntries() {
  let totalCleaned = 0;

  for (const [type, config] of Object.entries(RATE_LIMIT_CONFIGS)) {
    try {
      const keys = await redis.keys(`${config.prefix}:*`);

      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            const now = Date.now();

            // Remove expired entries
            if (parsed.resetTime && now >= parsed.resetTime) {
              await redis.del(key);
              totalCleaned++;
            }
          } catch (parseError) {
            // Remove corrupted entries
            await redis.del(key);
            totalCleaned++;
          }
        }
      }
    } catch (error) {
      console.error(`Error cleaning up ${type}:`, error);
    }
  }

  return totalCleaned;
}

/**
 * Display monitoring results
 */
function displayResults(stats, redisHealth, cleanedCount) {
  console.log("\n" + "=".repeat(60));
  console.log("🔍 RATE LIMIT MONITORING REPORT");
  console.log("=".repeat(60));

  // Redis Health
  console.log("\n📊 Redis Health:");
  if (redisHealth.status === "healthy") {
    console.log(`  ✅ Status: ${redisHealth.status}`);
    console.log(`  📈 Version: ${redisHealth.info.version}`);
    console.log(`  ⏱️  Uptime: ${redisHealth.info.uptime} seconds`);
    console.log(`  👥 Connected Clients: ${redisHealth.info.connected_clients}`);
    console.log(`  💾 Memory Usage: ${redisHealth.info.used_memory}`);
  } else {
    console.log(`  ❌ Status: ${redisHealth.status}`);
    console.log(`  🚨 Error: ${redisHealth.error}`);
  }

  // Rate Limit Statistics
  console.log("\n📊 Rate Limit Statistics:");
  console.log("-".repeat(40));

  for (const stat of stats) {
    console.log(`\n🔹 ${stat.type.toUpperCase()}:`);
    if (stat.error) {
      console.log(`  ❌ Error: ${stat.error}`);
      continue;
    }

    console.log(`  📋 Config: ${stat.config.max} requests per ${stat.config.window}`);
    console.log(`  👥 Total Entries: ${stat.totalEntries}`);
    console.log(`  ✅ Active Entries: ${stat.activeEntries}`);
    console.log(`  🚫 Blocked Entries: ${stat.blockedEntries}`);
    console.log(`  📈 Average Usage: ${stat.averageUsage} requests`);

    if (stat.activeEntries > 0) {
      const blockRate = ((stat.blockedEntries / stat.activeEntries) * 100).toFixed(1);
      console.log(`  📊 Block Rate: ${blockRate}%`);
    }
  }

  // Cleanup Results
  if (cleanedCount > 0) {
    console.log(`\n🧹 Cleanup: Removed ${cleanedCount} expired entries`);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📝 SUMMARY");
  console.log("=".repeat(60));

  const totalEntries = stats.reduce((sum, stat) => sum + (stat.totalEntries || 0), 0);
  const totalActive = stats.reduce((sum, stat) => sum + (stat.activeEntries || 0), 0);
  const totalBlocked = stats.reduce((sum, stat) => sum + (stat.blockedEntries || 0), 0);

  console.log(`📊 Total Rate Limit Entries: ${totalEntries}`);
  console.log(`✅ Active Entries: ${totalActive}`);
  console.log(`🚫 Currently Blocked: ${totalBlocked}`);

  if (totalActive > 0) {
    const overallBlockRate = ((totalBlocked / totalActive) * 100).toFixed(1);
    console.log(`📈 Overall Block Rate: ${overallBlockRate}%`);
  }

  console.log(`\n🕐 Report generated: ${new Date().toISOString()}`);
  console.log("=".repeat(60));
}

/**
 * Main monitoring function
 */
async function main() {
  const args = process.argv.slice(2);
  const cleanup = args.includes("--cleanup");

  console.log("🚀 Starting rate limit monitoring...");

  // Load environment variables
  loadEnv();

  try {
    // Get Redis health
    const redisHealth = await getRedisHealth();

    // Get statistics for all rate limit types
    const stats = await Promise.all(
      Object.keys(RATE_LIMIT_CONFIGS).map(type => getRateLimitStats(type))
    );

    // Clean up expired entries if requested
    let cleanedCount = 0;
    if (cleanup) {
      console.log("🧹 Cleaning up expired entries...");
      cleanedCount = await cleanupExpiredEntries();
    }

    // Display results
    displayResults(stats, redisHealth, cleanedCount);

  } catch (error) {
    console.error("❌ Monitoring failed:", error.message);
    process.exit(1);
  }
}

// CLI help
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
Rate Limit Monitoring Script

Usage:
  node monitor.js [options]

Options:
  --cleanup    Clean up expired rate limit entries
  --help, -h   Show this help message

Examples:
  node monitor.js                    # Show monitoring report
  node monitor.js --cleanup          # Show report and cleanup expired entries
  `);
  process.exit(0);
}

// Run monitoring
main().catch(error => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});
