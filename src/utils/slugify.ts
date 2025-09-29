export const slugifyStr = (str: string): string => {
  // Enhanced slugify with Unicode support for Thai and other languages
  let slug = str.toLowerCase().trim();

  try {
    // Try Unicode-aware regex to support Thai and other languages
    slug = slug.replace(/[^\p{L}\p{N}\p{M}\s-]/gu, '');
  } catch (error) {
    // Fallback for environments that don't support Unicode property escapes
    // Remove common punctuation but keep Thai characters (U+0E00-U+0E7F)
    slug = slug.replace(/[^\u0E00-\u0E7F\w\s-]/g, '');
  }

  // Replace spaces, underscores and multiple hyphens with single hyphen
  slug = slug.replace(/[\s_-]+/g, '-');

  // Remove leading/trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');

  // Fallback: if slug is empty after processing, create a fallback slug
  if (!slug) {
    // Use a simple hash of the original string as fallback
    const hash = str.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    slug = `heading-${Math.abs(hash)}`;
  }

  return slug;
};

export const slugifyAll = (arr: string[]) => arr.map(str => slugifyStr(str));
