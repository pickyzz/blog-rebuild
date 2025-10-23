// Enhanced rate limiter with retry mechanism for Notion API requests.
// Ensures we don't exceed NOTION_RATE_LIMIT requests per second.
// This uses a sliding window of 1s and delays callers when the limit is reached.
const RATE_LIMIT = parseInt(process.env.NOTION_RATE_LIMIT || "3"); // requests per second
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second base delay
const MAX_RETRY_DELAY = 5000; // 5 seconds max delay

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

// Retry wrapper for Notion API calls with exponential backoff
export async function notionRetryWrapper<T>(
  operation: () => Promise<T>,
  operationName: string = "Notion operation"
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await throttleNotion();
      const result = await operation();

      // Log successful retry
      if (attempt > 1) {
        console.log(`[NOTION RETRY] ${operationName} succeeded on attempt ${attempt}`);
      }

      return result;
    } catch (error: any) {
      lastError = error;

      // Don't retry on certain errors
      if (error?.code === 'object_not_found' ||
          error?.code === 'unauthorized' ||
          error?.code === 'validation_error') {
        console.error(`[NOTION ERROR] ${operationName} failed permanently:`, error.message);
        throw error;
      }

      // Log retry attempt
      console.warn(`[NOTION RETRY] ${operationName} failed on attempt ${attempt}/${MAX_RETRIES}:`, error.message);

      // If this is the last attempt, throw the error
      if (attempt === MAX_RETRIES) {
        console.error(`[NOTION RETRY] ${operationName} failed after ${MAX_RETRIES} attempts`);
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(RETRY_DELAY * Math.pow(2, attempt - 1), MAX_RETRY_DELAY);
      console.log(`[NOTION RETRY] Retrying ${operationName} in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export function getNotionRateLimitState() {
  return { limit: RATE_LIMIT, recent: timestamps.slice() };
}
