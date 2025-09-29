import DOMPurify from 'isomorphic-dompurify';

export function sanitize(html) {
  // XSS sanitizer using DOMPurify, allowing only YouTube iframes
  if (typeof html !== "string") return "";

  // Sanitize with DOMPurify, forbidding dangerous tags and attributes
  let sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['iframe'],
    ALLOWED_ATTR: ['src'],
    FORBID_TAGS: ['script', 'object', 'embed', 'link', 'meta'],
    FORBID_ATTR: ['on*'],
    ALLOW_DATA_ATTR: false,
  });

  // Filter iframes to only allow YouTube embeds
  sanitized = sanitized.replace(/<iframe[^>]*>[\s\S]*?<\/iframe\s*>/gi, m => {
    if (m.includes("youtube.com/embed/") || m.includes("youtu.be/embed/")) {
      return m;
    }
    return "";
  });

  return sanitized;
}

export function sanitizeUrl(str) {
  return str
    .toLowerCase() // convert to lowercase
    .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric characters with hyphens
    .replace(/(^-|-$)+/g, ""); // remove leading/trailing hyphens
}

export function sanitizeImageString(str) {
  return str.replace(/[^a-zA-Z]/g, "").toLowerCase();
}
