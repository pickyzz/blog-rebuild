import { isS3Url } from "@/config";

// Background refresh utility for Notion S3 images
// This pre-emptively refreshes images before they expire

const S3_URL_EXPIRY_MINUTES = 60; // Notion S3 URLs expire in 1 hour
const REFRESH_BUFFER_MINUTES = 10; // Refresh 10 minutes before expiry
const REFRESH_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

interface TrackedImage {
  url: string;
  lastRefresh: number;
  refreshCount: number;
}

const trackedImages = new Map<string, TrackedImage>();
const MAX_TRACKED_IMAGES = 100; // Limit memory usage

// Extract timestamp from S3 signed URL
function extractS3Timestamp(url: string): number | null {
  try {
    const urlObj = new URL(url);
    const amzDate = urlObj.searchParams.get('X-Amz-Date');
    const amzExpires = urlObj.searchParams.get('X-Amz-Expires');

    if (amzDate && amzExpires) {
      // Parse format: 20251023T124401Z
      const dateStr = amzDate.replace('Z', '');
      const year = parseInt(dateStr.slice(0, 4));
      const month = parseInt(dateStr.slice(4, 6));
      const day = parseInt(dateStr.slice(6, 8));
      const hour = parseInt(dateStr.slice(9, 11));
      const minute = parseInt(dateStr.slice(11, 13));
      const second = parseInt(dateStr.slice(13, 15));

      const created = Date.UTC(year, month - 1, day, hour, minute, second);
      const expiresMs = parseInt(amzExpires) * 1000;

      return created + expiresMs;
    }
  } catch (e) {
    // Ignore parsing errors
  }
  return null;
}

// Check if S3 URL is close to expiry
function isNearExpiry(url: string, bufferMinutes = REFRESH_BUFFER_MINUTES): boolean {
  const expiryTime = extractS3Timestamp(url);
  if (!expiryTime) return false; // Can't determine expiry

  const now = Date.now();
  const bufferMs = bufferMinutes * 60 * 1000;

  return (expiryTime - now) <= bufferMs;
}

// Track an S3 image URL for monitoring
export function trackS3Image(url: string): void {
  if (!isS3Url(url)) return;

  const existing = trackedImages.get(url);
  const now = Date.now();

  if (!existing) {
    // Clean up old entries if we're at limit
    if (trackedImages.size >= MAX_TRACKED_IMAGES) {
      const oldest = Array.from(trackedImages.entries())
        .reduce((a, b) => a[1].lastRefresh < b[1].lastRefresh ? a : b);
      trackedImages.delete(oldest[0]);
    }

    trackedImages.set(url, {
      url,
      lastRefresh: now,
      refreshCount: 0
    });
  }
}

// Get images that need refreshing
export function getImagesNeedingRefresh(): string[] {
  const now = Date.now();
  const needRefresh: string[] = [];

  for (const [url, tracked] of trackedImages) {
    // Check if URL is near expiry
    if (isNearExpiry(url)) {
      needRefresh.push(url);
      tracked.lastRefresh = now;
      tracked.refreshCount++;
    }
  }

  return needRefresh;
}

// Background refresh monitor
export function startImageRefreshMonitor(): void {
  if (typeof window === 'undefined') {
    // Server-side: skip monitoring
    return;
  }

  // Check for images needing refresh periodically
  setInterval(() => {
    const needRefresh = getImagesNeedingRefresh();

    if (needRefresh.length > 0) {
      console.log(`[IMAGE REFRESH] Found ${needRefresh.length} images near expiry`);

      // Trigger refresh by updating image src attributes
      needRefresh.forEach(url => {
        const images = document.querySelectorAll(`img[src*="${encodeURIComponent(url)}"]`);
        images.forEach(img => {
          const currentSrc = img.getAttribute('src');
          if (currentSrc) {
            // Add timestamp to force refresh
            const separator = currentSrc.includes('?') ? '&' : '?';
            const newSrc = `${currentSrc}${separator}_refresh=${Date.now()}`;
            img.setAttribute('src', newSrc);
          }
        });
      });
    }
  }, REFRESH_CHECK_INTERVAL);
}

// Initialize monitoring when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startImageRefreshMonitor);
  } else {
    startImageRefreshMonitor();
  }
}
