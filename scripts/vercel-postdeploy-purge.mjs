#!/usr/bin/env node
// Called from Vercel build command after `npm run build` to purge Cloudflare URLs listed in CF_PURGE_URLS
// Set these Environment Variables in Vercel Project Settings:
// - CF_ZONE_ID
// - CF_API_TOKEN
// - CF_PURGE_URLS (comma-separated list of absolute URLs to purge)

import { argv } from 'process';
import fs from 'fs';
import path from 'path';

let urls = [];
const urlsEnv = process.env.CF_PURGE_URLS || '';
if (urlsEnv) {
  urls = urlsEnv.split(',').map(s => s.trim()).filter(Boolean);
}

// If no CF_PURGE_URLS env, try reading dist/purge-urls.json (generated during build)
if (urls.length === 0) {
  const purgeFile = path.resolve(process.cwd(), 'dist', 'purge-urls.json');
  if (fs.existsSync(purgeFile)) {
    try {
      const raw = fs.readFileSync(purgeFile, 'utf8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) urls = arr.map(String).filter(Boolean);
    } catch (e) {
      console.warn('Failed to read dist/purge-urls.json:', String(e));
    }
  }
}

if (urls.length === 0) {
  console.log('No purge URLs found (CF_PURGE_URLS empty and dist/purge-urls.json missing/empty) — skipping Cloudflare purge');
  process.exit(0);
}

const zone = process.env.CF_ZONE_ID;
const token = process.env.CF_API_TOKEN;

const payload = { files: urls };
console.log('Vercel post-deploy purge payload:', JSON.stringify(payload, null, 2));

if (!zone || !token) {
  console.warn('CF_ZONE_ID or CF_API_TOKEN not set — running in dry-run mode (no API call will be made)');
  process.exit(0);
}

const url = `https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`;
try {
  // Batch settings (Cloudflare accepts up to 30 files per request; default to 30)
  const BATCH_SIZE = parseInt(process.env.CF_PURGE_BATCH_SIZE || '30');
  const BATCH_DELAY_MS = parseInt(process.env.CF_PURGE_BATCH_DELAY_MS || '500');
  const MAX_BATCH_RETRIES = parseInt(process.env.CF_PURGE_BATCH_RETRIES || '2');

  async function purgeBatch(batch) {
    const body = JSON.stringify({ files: batch });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body
    });
    return res.json();
  }

  // Create batches
  const batches = [];
  for (let i = 0; i < urls.length; i += BATCH_SIZE) batches.push(urls.slice(i, i + BATCH_SIZE));

  console.log(`Purging ${urls.length} URLs in ${batches.length} batch(es) (batch size=${BATCH_SIZE})`);

  for (let idx = 0; idx < batches.length; idx++) {
    const batch = batches[idx];
    console.log(`Processing batch ${idx + 1}/${batches.length} (${batch.length} URLs)`);
    let attempt = 0;
    let ok = false;
    let lastJson = null;
    while (attempt <= MAX_BATCH_RETRIES && !ok) {
      attempt++;
      try {
        const json = await purgeBatch(batch);
        lastJson = json;
        if (json && json.success) {
          console.log(`Batch ${idx + 1} purged successfully`);
          ok = true;
          break;
        } else {
          console.warn(`Batch ${idx + 1} purge response not successful (attempt ${attempt}):`, JSON.stringify(json));
        }
      } catch (e) {
        console.warn(`Batch ${idx + 1} purge request failed (attempt ${attempt}):`, String(e));
      }
      if (!ok && attempt <= MAX_BATCH_RETRIES) {
        const backoff = 250 * attempt;
        console.log(`Retrying batch ${idx + 1} after ${backoff}ms`);
        await new Promise(r => setTimeout(r, backoff));
      }
    }
    if (!ok) {
      console.error(`Batch ${idx + 1} failed after ${attempt - 1} attempts. Last response:`, JSON.stringify(lastJson));
      process.exit(3);
    }
    // Delay between batches to avoid rate limits
    if (idx < batches.length - 1 && BATCH_DELAY_MS > 0) await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
  }

  console.log('Cloudflare purge completed successfully');
} catch (err) {
  console.error('Cloudflare purge request failed', err);
  process.exit(4);
}
