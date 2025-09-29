export function sanitize(html) {
  // Basic XSS sanitizer: removes <script>, on* attributes, javascript: URLs, and dangerous tags
  if (typeof html !== "string") return "";
  let prev;
  let sanitized = html;
  do {
    prev = sanitized;
    sanitized = sanitized
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script[^>]*>/gi, "")
      .replace(/on\w+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/data:/gi, "")
      .replace(/vbscript:/gi, "")
      .replace(/<iframe[\s\S]*?>[\s\S]*<\/iframe\s*>/gi, m =>
        m.includes("youtube.com") || m.includes("youtu.be") ? m : ""
      )
      .replace(/<iframe[^>]*>/gi, "")
      .replace(/<object[\s\S]*?>[\s\S]*<\/object\s*>/gi, "")
      .replace(/<embed[\s\S]*?>[\s\S]*<\/embed\s*>/gi, "")
      .replace(/<link[\s\S]*?\s*>/gi, "")
      .replace(/<meta[\s\S]*?\s*>/gi, "");
  } while (sanitized !== prev);
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
