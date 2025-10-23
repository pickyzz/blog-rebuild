export const SITE = {
  website: "https://pickyzz.dev/",
  author: "Parinya T.",
  profile: "https://pickyzz.dev/about/",
  desc: "Just a pieces of code",
  title: "Pickyzz",
  ogImage: "pickyzz-og.png",
  lightAndDarkMode: true,
  postOnIndex: 6,
  postPerPage: 8,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true, // show back button in post detail
} as const;

// Free Plan optimized caching settings
export const FREE_PLAN_CONFIG = {
  // Shorter cache times to reduce Upstash Redis usage
  POSTS_CACHE_TTL: 15 * 60 * 1000,        // 15 minutes (was 30)
  TAGS_CACHE_TTL: 30 * 60 * 1000,         // 30 minutes (was 60)
  POST_BY_SLUG_NEW_CACHE_TTL: 10 * 60 * 1000, // 10 minutes (was 20)
  POST_BY_SLUG_OLD_CACHE_TTL: 8 * 60 * 1000,   // 8 minutes (was 15)
  POSTS_BY_TAG: 15 * 60 * 1000,          // 15 minutes (was 30)

  // Image proxy settings for Free Plan
  IMAGE_MAX_BYTES: 3 * 1024 * 1024,       // 3MB (was 5MB)
  IMAGE_EDGE_S_MAXAGE: 2 * 60 * 60,       // 2 hours (was 24)
  IMAGE_ERROR_S_MAXAGE: 30,               // 30 seconds (was 60)
  IMAGE_PROXY_MAX_CONCURRENT: 4,          // Reduced for 10s timeout
  IMAGE_PROXY_HOST_COOLDOWN_MS: 500,      // Longer cooldown
  IMAGE_PROXY_FETCH_TIMEOUT_MS: 8000,     // Under 10s limit
} as const;

// Image proxy allowlist and helper moved here from src/config/image.ts
export const ALLOWED_IMAGE_HOSTS = [
  "s3.amazonaws.com",
  "prod-files-secure.s3.us-west-2.amazonaws.com",
  "images.unsplash.com",
  "pbs.twimg.com",
];

export function isAllowedUrl(u: string) {
  try {
    const url = new URL(u);
    if (url.protocol !== "https:") return false;
    return ALLOWED_IMAGE_HOSTS.some(
      h => url.hostname.endsWith(h) || url.hostname.includes(h)
    );
  } catch (e) {
    return false;
  }
}

// Helper to detect S3 URLs (Free Plan optimization)
export function isS3Url(url: string): boolean {
  return url.includes('s3.amazonaws.com') || url.includes('prod-files-secure');
}
