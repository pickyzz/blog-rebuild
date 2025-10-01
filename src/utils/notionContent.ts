import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import { unified } from "unified";
// --- sanitize import for HTML output ---
import { sanitize } from "../helpers/sanitize.mjs";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeRaw from "rehype-raw";
import Prism from "prismjs";
// Import Prism components in correct order to avoid dependency conflicts
import "prismjs/components/prism-core.js";
import "prismjs/plugins/autoloader/prism-autoloader.js";
import "prismjs/components/prism-clike.js";
import "prismjs/components/prism-javascript.js";
import "prismjs/components/prism-markup.js";
import "prismjs/components/prism-css.js";
import "prismjs/components/prism-bash.js";
import "prismjs/components/prism-shell-session.js";
import "prismjs/components/prism-python.js";
import "prismjs/components/prism-java.js";
import "prismjs/components/prism-c.js";
import "prismjs/components/prism-cpp.js";
import "prismjs/components/prism-csharp.js";
import "prismjs/components/prism-php.js";
import "prismjs/components/prism-ruby.js";
import "prismjs/components/prism-go.js";
import "prismjs/components/prism-rust.js";
import "prismjs/components/prism-swift.js";
import "prismjs/components/prism-kotlin.js";
import "prismjs/components/prism-dart.js";
import "prismjs/components/prism-scala.js";
import "prismjs/components/prism-sql.js";
import "prismjs/components/prism-yaml.js";
import "prismjs/components/prism-docker.js";
import "prismjs/components/prism-json.js";
import "prismjs/components/prism-markdown.js";
import "prismjs/components/prism-jsx.js";
import "prismjs/components/prism-tsx.js";
import "prismjs/components/prism-graphql.js";
import "prismjs/components/prism-powershell.js";
import "prismjs/components/prism-scss.js";
import "prismjs/components/prism-sass.js";
import "prismjs/components/prism-less.js";
// Try importing bash component directly
import "prismjs/components/prism-bash.js";
// Try other shell-related components
import "prismjs/components/prism-shell-session.js";
import "prismjs/components/prism-batch.js";

// Custom fallback for shell languages if Prism components fail to load
if (
  !Prism.languages.bash &&
  !Prism.languages.shell &&
  !Prism.languages["shell-session"]
) {
  // Create a simple shell language definition
  Prism.languages.shell = {
    comment: {
      pattern: /(^|[^\\])#.*/,
      lookbehind: true,
    },
    string: {
      pattern: /(["'])(?:\\.|(?!\1)[^\\\r\n])*\1/,
      greedy: true,
    },
    variable: {
      pattern: /\$[a-zA-Z_][a-zA-Z0-9_]*/,
      greedy: true,
    },
    function: {
      pattern: /\b\w+\(\)/,
      greedy: true,
    },
    keyword:
      /\b(?:if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|echo|cd|ls|pwd|mkdir|rm|cp|mv|cat|grep|sed|awk|chmod|chown|sudo|apt|yum|brew|npm|git|docker|kubectl)\b/,
  };

  // Alias bash to shell
  Prism.languages.bash = Prism.languages.shell;
  Prism.languages["shell-session"] = Prism.languages.shell;
}
// REMOVE shiki imports and initHighlighter
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
  const content = code?.rich_text?.[0]?.plain_text || "";
  const caption = code?.caption?.[0]?.plain_text || "";

  try {
    // Map Notion language names to Prism language names
    const languageMap: { [key: string]: string } = {
      javascript: "javascript",
      js: "javascript",
      typescript: "typescript",
      ts: "typescript",
      python: "python",
      py: "python",
      java: "java",
      c: "c",
      cpp: "cpp",
      "c++": "cpp",
      csharp: "csharp",
      "c#": "csharp",
      php: "php",
      ruby: "ruby",
      go: "go",
      rust: "rust",
      swift: "swift",
      kotlin: "kotlin",
      dart: "dart",
      scala: "scala",
      sql: "sql",
      html: "markup",
      xml: "markup",
      css: "css",
      scss: "scss",
      sass: "sass",
      less: "less",
      json: "json",
      yaml: "yaml",
      yml: "yaml",
      dockerfile: "docker",
      bash: "bash",
      shell: "bash",
      sh: "bash",
      powershell: "powershell",
      markdown: "markdown",
      md: "markdown",
      graphql: "graphql",
      jsx: "jsx",
      tsx: "tsx",
      text: "text",
      plain: "text",
      plaintext: "text",
    };

    // Normalize language name
    const normalizedLanguage = languageMap[language.toLowerCase()] || "text";

    // Check if Prism supports this language, with fallbacks
    let prismLanguage = Prism.languages[normalizedLanguage];
    if (!prismLanguage) {
      // Try common fallbacks for shell languages
      if (["bash", "shell", "sh"].includes(normalizedLanguage)) {
        prismLanguage =
          Prism.languages["bash"] ||
          Prism.languages["shell"] ||
          Prism.languages["text"];
      } else {
        prismLanguage = Prism.languages["text"];
      }
    }

    if (!prismLanguage) {
      // Fallback to plain text with basic styling
      const escapedContent = content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

      return `<div class="notion-code-block" data-language="${language}">
  <div class="code-header">
    <span class="language-label">${language}</span>
    <button class="copy-button" onclick="copyCodeBlock(this)" aria-label="Copy code">Copy</button>
  </div>
  <div class="code-content">
    <pre><code class="language-${normalizedLanguage}">${escapedContent}</code></pre>
  </div>
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</div>`;
    }

    // Use Prism for syntax highlighting
    const highlightedContent = Prism.highlight(
      content,
      prismLanguage,
      normalizedLanguage
    );

    return `<div class="notion-code-block" data-language="${language}">
  <div class="code-header">
    <span class="language-label">${language}</span>
    <button class="copy-button" onclick="copyCodeBlock(this)" aria-label="Copy code">Copy</button>
  </div>
  <div class="code-content">
    <pre><code class="language-${normalizedLanguage}">${highlightedContent}</code></pre>
  </div>
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</div>`;
  } catch (error) {
    // Fallback to plain text with basic styling
    const escapedContent = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

    return `<div class="notion-code-block" data-language="${language}">
  <div class="code-header">
    <span class="language-label">${language}</span>
    <button class="copy-button" onclick="copyCodeBlock(this)" aria-label="Copy code">Copy</button>
  </div>
  <div class="code-content">
    <pre><code class="language-${language}">${escapedContent}</code></pre>
  </div>
  ${caption ? `<figcaption>${caption}</figcaption>` : ""}
</div>`;
  }
});

n2m.setCustomTransformer("quote", async (block: any) => {
  const { quote } = block;
  const content = quote?.rich_text?.[0]?.plain_text || "";

  return `<blockquote class="notion-quote">
  <p>${content}</p>
</blockquote>`;
});

n2m.setCustomTransformer("callout", async (block: any) => {
  const { callout } = block;
  const content = callout?.rich_text?.[0]?.plain_text || "";
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
      .use(rehypeStringify)
      .process(mdString);

    const result = String(htmlContent);

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
    const response = await notion.blocks.children.list({
      block_id: pageId,
    });

    // Cache the result
    setCacheData(
      blocksCache,
      cacheKey,
      response.results,
      CACHE_CONFIG.PAGE_BLOCKS
    );
    return response.results;
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
