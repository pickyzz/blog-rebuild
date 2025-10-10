import { purgeCloudflare } from './cloudflarePurge';
import { addPurgeUrl } from './purgeList';

const BATCH_MS = parseInt(process.env.CF_PURGE_BATCH_MS || '2000'); // debounce window
const MAX_BATCH = parseInt(process.env.CF_PURGE_MAX_BATCH || '30');
const MAX_RETRIES = parseInt(process.env.CF_PURGE_MAX_RETRIES || '3');

const queue = new Set<string>();
let timer: any = null;
let flushing = false;

function scheduleFlush() {
  if (!timer) {
    timer = setTimeout(() => flush().catch(e => { try { console.warn('[CF PURGE QUEUE] flush error', e); } catch(_){} }), BATCH_MS);
  }
}

export function enqueuePurge(url: string) {
  try {
    if (!url) return;
    queue.add(url);
    try { addPurgeUrl(url); } catch (e) {}
    scheduleFlush();
  } catch (e) {
    try { console.warn('[CF PURGE QUEUE] enqueue failed', String(e)); } catch(_){}
  }
}

async function flush() {
  if (flushing) return;
  flushing = true;
  timer = null;

  while (queue.size > 0) {
    const items: string[] = Array.from(queue).slice(0, MAX_BATCH);
    items.forEach(i => queue.delete(i));

    const zone = process.env.CF_ZONE_ID;
    const token = process.env.CF_API_TOKEN;
    if (!zone || !token) {
      try { console.log('[CF PURGE QUEUE] CF creds missing, dry-run purge for:', items); } catch(_){}
      continue; // still remove from queue (we wrote to purge list)
    }

    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      try {
        await purgeCloudflare(items, { zoneId: zone, apiToken: token, dryRun: false });
        break;
      } catch (err) {
        attempt++;
        const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000) + Math.floor(Math.random() * 200);
        try { console.warn(`[CF PURGE QUEUE] purge attempt ${attempt} failed, retrying in ${delay}ms`); } catch(_){}
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }

  flushing = false;
}

// expose manual flush for debugging/tests
export async function flushQueue() {
  await flush();
}
