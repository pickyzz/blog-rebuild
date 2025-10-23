#!/usr/bin/env node

/**
 * ISR Cache Warming Script
 * Pre-warms cache for important pages after deployment
 */

import { performance } from 'perf_hooks';
import { loadEnv } from 'vite';

// Load environment variables
const env = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), '');

// Configuration
const SITE_URL = env.PUBLIC_SITE_URL || 'https://pickyzz.dev';
const API_SECRET = env.API_SECRET_KEY;

// Pages to warm cache for
const PAGES_TO_WARM = [
  { path: '/', priority: 'high' },
  { path: '/blog', priority: 'high' },
  { path: '/about', priority: 'medium' },
  { path: '/search', priority: 'medium' },
  { path: '/archives', priority: 'low' },
];

// API endpoints to warm cache for
const API_ENDPOINTS = [
  '/api/search.json',
  '/api/revalidate/all',
];

/**
 * Fetch URL with retry logic
 */
async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'ISR Cache Warmer',
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      console.warn(`[CACHE WARM] Attempt ${i + 1} failed for ${url}:`, error.message);

      if (i === retries - 1) {
        throw error;
      }

      // Exponential backoff
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Warm cache for a single page
 */
async function warmPage(page) {
  const startTime = performance.now();
  const url = `${SITE_URL}${page.path}`;

  try {
    console.log(`[CACHE WARM] Warming cache for ${page.path} (${page.priority})`);

    const response = await fetchWithRetry(url);
    const responseTime = Math.round(performance.now() - startTime);

    // Extract useful headers
    const cacheControl = response.headers.get('cache-control');
    const xCache = response.headers.get('x-cache') || response.headers.get('x-vercel-cache');

    console.log(`[CACHE WARM] ✓ ${page.path} - ${responseTime}ms (${xCache || 'no-cache-info'})`);

    return {
      url,
      path: page.path,
      priority: page.priority,
      success: true,
      responseTime,
      cacheControl,
      xCache,
    };
  } catch (error) {
    const responseTime = Math.round(performance.now() - startTime);
    console.error(`[CACHE WARM] ✗ ${page.path} - ${responseTime}ms - ${error.message}`);

    return {
      url,
      path: page.path,
      priority: page.priority,
      success: false,
      responseTime,
      error: error.message,
    };
  }
}

/**
 * Warm cache for API endpoints
 */
async function warmAPI(endpoint) {
  const startTime = performance.now();
  const url = `${SITE_URL}${endpoint}`;

  try {
    console.log(`[CACHE WARM] Warming cache for API ${endpoint}`);

    // Skip revalidate endpoints during build (they require auth)
    if (endpoint.includes('/api/revalidate')) {
      console.log(`[CACHE WARM] ⏭️  Skipping ${endpoint} (requires auth)`);
      return {
        url,
        endpoint,
        success: true,
        responseTime: 0,
        skipped: true,
      };
    }

    const response = await fetchWithRetry(url, {
      headers: {
        ...(API_SECRET && { Authorization: `Bearer ${API_SECRET}` }),
      },
    });

    const responseTime = Math.round(performance.now() - startTime);
    const xCache = response.headers.get('x-cache') || response.headers.get('x-vercel-cache');

    console.log(`[CACHE WARM] ✓ ${endpoint} - ${responseTime}ms (${xCache || 'no-cache-info'})`);

    return {
      url,
      endpoint,
      success: true,
      responseTime,
      xCache,
    };
  } catch (error) {
    const responseTime = Math.round(performance.now() - startTime);
    console.error(`[CACHE WARM] ✗ ${endpoint} - ${responseTime}ms - ${error.message}`);

    return {
      url,
      endpoint,
      success: false,
      responseTime,
      error: error.message,
    };
  }
}

// Simple results display function
function displayResults(pageResults, apiResults) {
  const allResults = [...pageResults, ...apiResults];
  const successful = allResults.filter(r => r.success && !r.skipped);
  const failed = allResults.filter(r => !r.success && !r.skipped);
  const skipped = allResults.filter(r => r.skipped);

  console.log('\n' + '='.repeat(60));
  console.log('🔥 ISR CACHE WARMING RESULTS');
  console.log('='.repeat(60));
  console.log(`Total URLs: ${allResults.length}`);
  console.log(`Successful: ${successful.length} (${Math.round(successful.length / allResults.length * 100)}%)`);
  console.log(`Failed: ${failed.length} (${Math.round(failed.length / allResults.length * 100)}%)`);

  if (skipped.length > 0) {
    console.log(`Skipped: ${skipped.length} (${Math.round(skipped.length / allResults.length * 100)}%)`);
  }

  if (failed.length > 0) {
    console.log('\n❌ Failed URLs:');
    failed.forEach(result => {
      console.log(`  - ${result.path || result.endpoint}: ${result.error}`);
    });
  }

  if (skipped.length > 0) {
    console.log('\n⏭️  Skipped URLs:');
    skipped.forEach(result => {
      console.log(`  - ${result.path || result.endpoint}: requires authentication`);
    });
  }

  const successfulPages = pageResults.filter(r => r.success);
  if (successfulPages.length > 0) {
    console.log('\n✅ Successfully Warmed:');
    successfulPages.forEach(result => {
      console.log(`  - ${result.path}: ${result.responseTime}ms`);
    });
  }

  console.log('\n✨ Cache warming completed!');
  console.log('='.repeat(60));
}

/**
 * Main function
 */
async function main() {
  const startTime = performance.now();

  console.log('🚀 Starting ISR cache warming...');
  console.log(`📍 Target: ${SITE_URL}`);
  console.log(`📅 Time: ${new Date().toISOString()}`);
  console.log('');

  try {
    // Warm pages in parallel (with concurrency limit)
    const pageResults = await Promise.all(
      PAGES_TO_WARM.map(page => warmPage(page))
    );

    // Warm API endpoints
    const apiResults = await Promise.all(
      API_ENDPOINTS.map(endpoint => warmAPI(endpoint))
    );

    // Display results
    displayResults(pageResults, apiResults);

    const totalTime = Math.round(performance.now() - startTime);
    console.log(`\n⏱️  Total time: ${totalTime}ms`);

    // Don't fail build if some endpoints fail (they might require auth)
    const criticalFailures = pageResults.filter(r => !r.success && r.priority === 'high').length;
    process.exit(criticalFailures > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n💥 Cache warming failed:', error);
    process.exit(1);
  }
}

// Run script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as warmCache };
