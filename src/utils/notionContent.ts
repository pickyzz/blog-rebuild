import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import { unified } from "unified";
import { sanitize } from "../helpers/sanitize.mjs";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeRaw from "rehype-raw";
import { throttleNotion } from "./notionRateLimiter";

// Shiki will be dynamically imported when needed to avoid load-time errors in environments
// where it may not be installed. We will lazy-initialize a highlighter with a small set of
// commonly used languages and a readable theme.

const NOTION_KEY = import.meta.env.NOTION_KEY;

if (!NOTION_KEY) {
  throw new Error("Missing NOTION_KEY environment variable");
}

const notion = new Client({
  auth: NOTION_KEY,
});

// TTL Configuration for different content types (in milliseconds)
const CACHE_CONFIG = {
  PAGE_CONTENT: 15 * 60 * 1000, // 15 minutes - content changes less frequently
  PAGE_BLOCKS: 20 * 60 * 1000, // 20 minutes - blocks are stable
  ERROR_CONTENT: 1 * 60 * 1000, // 1 minute - retry errors sooner
  ERROR_BLOCKS: 2 * 60 * 1000, // 2 minutes - retry block errors
} as const;

const contentCache = new Map<
  string,
  { data: string; timestamp: number; ttl: number }
>();
const blocksCache = new Map<
  string,
  { data: any[]; timestamp: number; ttl: number }
>();

// Helper function to check if cache is valid
function isCacheValid(timestamp: number, ttl: number): boolean {
  return Date.now() - timestamp < ttl;
}

// Helper function to get cached data or null if expired
function getCachedData<T>(
  cache: Map<string, { data: T; timestamp: number; ttl: number }>,
  key: string
): T | null {
  const cached = cache.get(key);
  if (cached && isCacheValid(cached.timestamp, cached.ttl)) {
    return cached.data;
  }
  if (cached) {
    cache.delete(key); // Remove expired cache
  }
  return null;
}

// Helper function to set cache data with specific TTL
function setCacheData<T>(
  cache: Map<string, { data: T; timestamp: number; ttl: number }>,
  key: string,
  data: T,
  ttl: number
): void {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

// Helper function to invalidate specific cache entry
function invalidateCache(cache: Map<string, any>, key: string): void {
  cache.delete(key);
}

// Helper function to clear all expired cache entries
function clearExpiredCache(
  cache: Map<string, { timestamp: number; ttl: number }>
): void {
  for (const [key, value] of cache.entries()) {
    if (!isCacheValid(value.timestamp, value.ttl)) {
      cache.delete(key);
    }
  }
}

// Helper function to get cache stats
function getCacheStats(cache: Map<string, any>): {
  size: number;
  keys: string[];
} {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}

// Initialize Notion to Markdown converter
const n2m = new NotionToMarkdown({ notionClient: notion });

// Shiki highlighter instance (lazy-loaded)
let shikiHighlighter: any = null;
async function ensureShiki() {
  if (shikiHighlighter) return shikiHighlighter;
  try {
    const shiki = await import('shiki');
  const shikiAny = shiki as any;
  const createHighlighter = shikiAny.createHighlighter || shikiAny.getHighlighter || shikiAny.getSingletonHighlighter;
    // Load a compact set of common languages to keep startup reasonable. Shiki will
    // still work for other langs if bundledLanguages are available, but this covers
    // typical blog languages.
    const langs = ['javascript','typescript','tsx','jsx','python','bash','json','html','css','yaml','go','rust'];
    // Preload both GitHub light/dark Shiki themes so we can render both variants
    shikiHighlighter = await createHighlighter({ themes: ['github-light', 'github-dark-dimmed'], langs });
    return shikiHighlighter;
  } catch (err) {
    // Shiki initialization failed; proceed without highlighter
    shikiHighlighter = null;
    return null;
  }
}

// Custom transformers for better HTML output
n2m.setCustomTransformer("image", async (block: any) => {
  const { image } = block;
  const imageUrl = image?.file?.url || image?.external?.url;
  const caption = image?.caption?.[0]?.plain_text || "";

  // Use proxy URL to serve image; prefer original URL for data-large if available
  const proxyUrl = `/api/image/${block.id}`;
  const dataLargeUrl = imageUrl || proxyUrl;

  if (caption) {
    return `<figure class="notion-image">
  <img src="${proxyUrl}" data-large="${dataLargeUrl}" alt="${caption}" loading="lazy" class="img-loading blurry-load" />
  <figcaption>${caption}</figcaption>
</figure>`;
  }

  return `<img src="${proxyUrl}" data-large="${dataLargeUrl}" alt="Image from blog post" loading="lazy" class="notion-image img-loading blurry-load" />`;
});

n2m.setCustomTransformer("video", async (block: any) => {
  const { video } = block;
  const videoUrl = video?.file?.url || video?.external?.url;
  const caption = video?.caption?.[0]?.plain_text || "";

  // Handle YouTube videos with precise hostname check
  try {
    const url = new URL(videoUrl);
    if (
      url.hostname === "youtube.com" ||
      url.hostname === "www.youtube.com" ||
      url.hostname === "youtu.be"
    ) {
      let videoId = "";
      if (url.hostname === "youtu.be") {
        videoId = url.pathname.slice(1).split("/")[0];
      } else if (url.searchParams.has("v")) {
        videoId = url.searchParams.get("v") || "";
      }

      // Validate video ID: must be exactly 11 characters, alphanumeric + _ -
      if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return `<figure class="notion-video">
  <iframe width="100%" height="480" src="https://www.youtube.com/embed/${videoId}"
    title="YouTube video player" frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen></iframe>
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</figure>`;
      }
    }
  } catch (e) {
    // Invalid URL, fall back to generic video handling
  }

  // Handle other video formats
  return `<figure class="notion-video">
  <video controls>
    <source src="${videoUrl}" type="video/mp4">
    Your browser does not support the video tag.
  </video>
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</figure>`;
});

n2m.setCustomTransformer("embed", async (block: any) => {
  const { embed } = block;
  const url = embed?.url;
  const caption = embed?.caption?.[0]?.plain_text || "";

  if (!url) return "";

  return `<figure class="notion-embed">
  <iframe src="${url}" width="100%" height="400" frameborder="0"></iframe>
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</figure>`;
});

n2m.setCustomTransformer("code", async (block: any) => {
  const { code } = block;
  const language = code?.language || "text";
  const displayLanguage = (lang: string) => {
    const map: Record<string, string> = {
      ts: "TypeScript",
      typescript: "TypeScript",
      js: "JavaScript",
      javascript: "JavaScript",
      jsx: "JSX",
      tsx: "TSX",
      json: "JSON",
      css: "CSS",
      scss: "SCSS",
      html: "HTML",
      bash: "Bash",
      sh: "Shell",
      shell: "Shell",
      md: "Markdown",
      markdown: "Markdown",
      yaml: "YAML",
      yml: "YAML",
      text: "text",
    };
    const key = lang?.toLowerCase?.() || "";
    if (map[key]) return map[key];
    // For unknown languages, keep lowercase as Notion often shows lowercase identifiers
    return key || "text";
  };
  const content = code?.rich_text?.map((rt: any) => rt.plain_text).join("") || "";
  const caption = code?.caption?.[0]?.plain_text || "";

  // Try to highlight with Shiki; fall back to escaped pre/code. To avoid the
  // markdown/html pipeline escaping our highlighted HTML (which can happen
  // when the transformer output is treated as literal code), we emit a small
  // base64 placeholder that we will replace with the real HTML after the
  // unified pipeline finishes its work. The placeholder uses a data- attribute
  // so it survives sanitizeHtml.
  let placeholderHtml: string | null = null;
  try {
    const highlighter = await ensureShiki();
    if (highlighter) {
      const lightHtml = highlighter.codeToHtml(content, { lang: language, theme: 'github-light' });
      const darkHtml = highlighter.codeToHtml(content, { lang: language, theme: 'github-dark-dimmed' });
      const combined = `${lightHtml}\n<!--SHIKI-SPLIT-->\n${darkHtml}`;
      // base64 so we can safely carry it through the pipeline in an attribute
      const b64 = Buffer.from(combined, 'utf8').toString('base64');
      placeholderHtml = `<div data-shiki-b64="${b64}"></div>`;
      // placeholder generated successfully
    } else {
      // Shiki highlighter not available, falling back to plain code
    }
  } catch (err) {
    // Shiki highlighting failed; fall back to plain code
    placeholderHtml = null;
  }

  if (placeholderHtml) {
    return `<div class="notion-code-block" data-language="${language}">
  <div class="code-header">
    <span class="language-label">${displayLanguage(language)}</span>
    <button class="copy-button" aria-label="Copy code">
      <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M16 1H4a2 2 0 0 0-2 2v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><rect x="8" y="5" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></rect></svg>
      <span class="icon-label">Copy</span>
    </button>
  </div>
  <div class="code-content">
    ${placeholderHtml}
  </div>
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</div>`;
  }

  // Fallback: escape HTML and render plain code block
  const escapedContent = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

  return `<div class="notion-code-block" data-language="${language}">
<div class="code-header">
<span class="language-label">${displayLanguage(language)}</span>
<button class="copy-button" aria-label="Copy code">
  <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M16 1H4a2 2 0 0 0-2 2v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><rect x="8" y="5" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></rect></svg>
  <span class="icon-label">Copy</span>
</button>
</div>
<div class="code-content">
<pre class="language-${language}"><code class="language-${language}">${escapedContent}</code></pre>
</div>
${caption ? `<figcaption>${caption}</figcaption>` : ""}
</div>`;
});

// Helper: escape HTML entities for safe text content
function escapeHtml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(str: string): string {
  return escapeHtml(str).replace(/`/g, "&#96;");
}

// Render Notion rich_text array preserving inline annotations (code, bold, italic, underline, strike, link)
function renderRichText(rich: any[] | undefined): string {
  if (!rich || !Array.isArray(rich) || rich.length === 0) return "";
  return rich
    .map((rt) => {
      const raw = rt?.plain_text ?? rt?.text?.content ?? "";
      let html = escapeHtml(raw);
      const ann = rt?.annotations || {};
      if (ann.code) html = `<code>${html}</code>`;
      if (ann.bold) html = `<strong>${html}</strong>`;
      if (ann.italic) html = `<em>${html}</em>`;
      if (ann.underline) html = `<u>${html}</u>`;
      if (ann.strikethrough) html = `<s>${html}</s>`;
      const href = rt?.href || rt?.text?.link?.url;
      if (href) html = `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${html}</a>`;
      return html;
    })
    .join("");
}

n2m.setCustomTransformer("quote", async (block: any) => {
  const { quote } = block;
  const content = renderRichText(quote?.rich_text) || "";

  return `<blockquote class="notion-quote">
  <p>${content}</p>
</blockquote>`;
});

n2m.setCustomTransformer("callout", async (block: any) => {
  const { callout } = block;
  const content = renderRichText(callout?.rich_text) || "";
  const emoji = callout?.icon?.emoji || "💡";

  return `<div class="notion-callout">
  <div class="callout-icon">${emoji}</div>
  <div class="callout-content">${content}</div>
</div>`;
});

export async function getNotionPageContent(pageId: string): Promise<string> {
  // Check cache first
  const cacheKey = `content_${pageId}`;
  const cachedContent = getCachedData(contentCache, cacheKey);
  if (cachedContent) {
    return cachedContent;
  }

  try {
    // Fetch page blocks from Notion
    const mdblocks = await n2m.pageToMarkdown(pageId);

    // Convert to markdown string
    const { parent: mdString } = n2m.toMarkdownString(mdblocks);

    if (!mdString) {
      const noContent = "<p>No content available</p>";
      setCacheData(
        contentCache,
        cacheKey,
        noContent,
        CACHE_CONFIG.PAGE_CONTENT
      );
      return noContent;
    }

    // Convert markdown to HTML
    const htmlContent = await unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(rehypeRaw)
      .use(rehypeStringify, { allowDangerousHtml: true })
      .process(mdString);

    let result = String(htmlContent);

    // Some code blocks were ending up with our Shiki-generated HTML escaped
    // (for example: &lt;div class="shiki-wrap" ... &gt;). This typically happens
    // when the HTML returned from the custom transformer is interpreted as
    // literal text later in the markdown -> HTML pipeline. To fix that, look
    // for <pre><code> blocks whose decoded content contains our marker
    // ("<div class=\"shiki-wrap\"") and replace the entire <pre><code>
    // node with the decoded HTML so the Shiki markup remains live.
    const decodeHtmlEntities = (str: string) =>
      str
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    result = result.replace(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/gi, (match, attrs, inner) => {
      const decoded = decodeHtmlEntities(inner);
      // If decoded contains our shiki wrapper, assume it was escaped and
      // replace the whole pre/code block with the decoded HTML (which
      // already contains the <pre class="shiki">...</pre> fragments).
      if (decoded.includes('<div class="shiki-wrap"') || decoded.includes("<pre class=\"shiki")) {
        return decoded;
      }
      return match;
    });

    // Replace any Shiki placeholders produced by our custom transformer.
    // Placeholders look like: <div data-shiki-b64="..."></div>
    result = result.replace(/<div data-shiki-b64="([A-Za-z0-9+/=]+)"><\/div>/g, (m, b64) => {
      try {
        const decoded = Buffer.from(b64, 'base64').toString('utf8');
        // decoded contains lightHTML \n<!--SHIKI-SPLIT-->\n darkHTML
        const [lightHtml, darkHtml] = decoded.split('<!--SHIKI-SPLIT-->');
        const light = (lightHtml || '').trim();
        const dark = (darkHtml || '').trim();
        return `\n<div class="shiki-wrap" data-theme="light">${light}</div>\n<div class="shiki-wrap" data-theme="dark">${dark}</div>\n`;
      } catch (e) {
        return m;
      }
    });

    // Sanitize HTML output before caching and returning
    const sanitized = sanitize(result);

    // Cache the result
    setCacheData(contentCache, cacheKey, sanitized, CACHE_CONFIG.PAGE_CONTENT);
    return sanitized;
  } catch (error) {
    const errorContent = `<div class="error-message">
      <p>Unable to load content from Notion.</p>
      <p>Error: ${error instanceof Error ? error.message : "Unknown error"}</p>
    </div>`;
    // Cache error content for a shorter time to allow retries
    setCacheData(
      contentCache,
      cacheKey,
      errorContent,
      CACHE_CONFIG.ERROR_CONTENT
    );
    return errorContent;
  }
}

export async function getNotionPageBlocks(pageId: string) {
  // Check cache first
  const cacheKey = `blocks_${pageId}`;
  const cachedBlocks = getCachedData(blocksCache, cacheKey);
  if (cachedBlocks) {
    return cachedBlocks;
  }

  try {
    // Helper to fetch all children for a block (handles pagination)
    async function fetchAllChildren(blockId: string) {
      const params: any = { block_id: blockId, page_size: 100 };
      let results: any[] = [];
      while (true) {
        await throttleNotion();
        const res = await notion.blocks.children.list(params as any);
        results = results.concat(res.results || []);
        if (!res.has_more) break;
        params.start_cursor = res.next_cursor;
      }
      return results;
    }

    // Fetch top-level blocks (paginated)
    const topLevel = await fetchAllChildren(pageId);

    // For any block that has children, recursively fetch their children and attach
    // This mirrors otoyo's approach to fully expand nested content
    async function expandNested(blocks: any[]) {
      for (const block of blocks) {
        if (block.has_children) {
          const children = await fetchAllChildren(block.id);
          // Attach expanded children for convenience
          block.children = children;
          // Recursively expand deeper levels
          await expandNested(children);
        }
      }
    }

    await expandNested(topLevel);

    // Cache the result
    setCacheData(blocksCache, cacheKey, topLevel, CACHE_CONFIG.PAGE_BLOCKS);
    return topLevel;
  } catch (error) {
    // Cache empty array for errors to avoid repeated failed requests
    setCacheData(blocksCache, cacheKey, [], CACHE_CONFIG.ERROR_BLOCKS);
    return [];
  }
}

// Cache management functions
export function invalidateAllContentCaches(): void {
  contentCache.clear();
  blocksCache.clear();
}

export function invalidatePageContent(pageId: string): void {
  const contentKey = `content_${pageId}`;
  const blocksKey = `blocks_${pageId}`;
  invalidateCache(contentCache, contentKey);
  invalidateCache(blocksCache, blocksKey);
}

export function getContentCacheStatistics(): {
  content: { size: number; keys: string[] };
  blocks: { size: number; keys: string[] };
} {
  return {
    content: getCacheStats(contentCache),
    blocks: getCacheStats(blocksCache),
  };
}

export function cleanupExpiredContentCaches(): void {
  clearExpiredCache(contentCache);
  clearExpiredCache(blocksCache);
}
