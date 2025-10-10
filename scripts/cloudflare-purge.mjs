#!/usr/bin/env node
import { argv } from 'process';
import fs from 'fs';

// Usage:
//   node scripts/cloudflare-purge.mjs --dry-run /api/image/p/<token> ...
//   CF_ZONE_ID=... CF_API_TOKEN=... node scripts/cloudflare-purge.mjs /api/image/p/<token> ...

function usageAndExit() {
  console.error('Usage: node scripts/cloudflare-purge.mjs [--dry-run] <url> [<url> ...]');
  process.exit(2);
}

const args = argv.slice(2);
if (args.length === 0) usageAndExit();
let dryRun = false;
if (args[0] === '--dry-run') {
  dryRun = true;
  args.shift();
}

if (args.length === 0) usageAndExit();

const zone = process.env.CF_ZONE_ID;
const token = process.env.CF_API_TOKEN;

const payload = { files: args };

console.log('Cloudflare Purge —', dryRun ? 'DRY RUN' : 'EXECUTE');
console.log('Payload:', JSON.stringify(payload, null, 2));

if (dryRun) process.exit(0);

if (!zone || !token) {
  console.error('CF_ZONE_ID and CF_API_TOKEN environment variables are required to execute purge');
  process.exit(2);
}

const url = `https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`;

try {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  console.log('Cloudflare response:', JSON.stringify(json, null, 2));
  if (!json.success) process.exit(3);
} catch (err) {
  console.error('Purge failed:', err);
  process.exit(4);
}
