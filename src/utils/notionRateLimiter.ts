// Simple in-process rate limiter for Notion API requests.
// Ensures we don't exceed NOTION_RATE_LIMIT requests per second.
// This uses a sliding window of 1s and delays callers when the limit is reached.
const RATE_LIMIT = parseInt(process.env.NOTION_RATE_LIMIT || "3"); // requests per second

let timestamps: number[] = [];

function now() {
  return Date.now();
}

export async function throttleNotion(): Promise<void> {
  if (RATE_LIMIT <= 0) return; // no throttling if misconfigured

  while (true) {
    const t = now();
    // keep only timestamps within the last 1000ms
    timestamps = timestamps.filter(ts => t - ts < 1000);
    if (timestamps.length < RATE_LIMIT) {
      timestamps.push(t);
      return;
    }

    // need to wait until the oldest timestamp falls outside the window
    const oldest = timestamps[0];
    const waitMs = 1000 - (t - oldest) + 5; // small padding
    await new Promise(res => setTimeout(res, waitMs));
  }
}

export function getNotionRateLimitState() {
  return { limit: RATE_LIMIT, recent: timestamps.slice() };
}
