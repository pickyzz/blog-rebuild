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
