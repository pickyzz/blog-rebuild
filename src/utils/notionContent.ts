import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeRaw from 'rehype-raw';
import Prism from 'prismjs';
// Import only essential Prism components to avoid conflicts
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markdown';
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
  PAGE_CONTENT: 15 * 60 * 1000,    // 15 minutes - content changes less frequently
  PAGE_BLOCKS: 20 * 60 * 1000,     // 20 minutes - blocks are stable
  ERROR_CONTENT: 1 * 60 * 1000,     // 1 minute - retry errors sooner
  ERROR_BLOCKS: 2 * 60 * 1000,      // 2 minutes - retry block errors
} as const;

const contentCache = new Map<string, { data: string, timestamp: number; ttl: number }>();
const blocksCache = new Map<string, { data: any[], timestamp: number; ttl: number }>();

// Helper function to check if cache is valid
function isCacheValid(timestamp: number, ttl: number): boolean {
  return Date.now() - timestamp < ttl;
}

// Helper function to get cached data or null if expired
function getCachedData<T>(cache: Map<string, { data: T, timestamp: number; ttl: number }>, key: string): T | null {
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
function setCacheData<T>(cache: Map<string, { data: T, timestamp: number; ttl: number }>, key: string, data: T, ttl: number): void {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

// Helper function to invalidate specific cache entry
function invalidateCache(cache: Map<string, any>, key: string): void {
  cache.delete(key);
}

// Helper function to clear all expired cache entries
function clearExpiredCache(cache: Map<string, { timestamp: number; ttl: number }>): void {
  for (const [key, value] of cache.entries()) {
    if (!isCacheValid(value.timestamp, value.ttl)) {
      cache.delete(key);
    }
  }
}

// Helper function to get cache stats
function getCacheStats(cache: Map<string, any>): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
}

// Initialize Notion to Markdown converter
const n2m = new NotionToMarkdown({ notionClient: notion });

// Custom transformers for better HTML output
n2m.setCustomTransformer("image", async (block: any) => {
  const { image } = block;
  const imageUrl = image?.file?.url || image?.external?.url;
  const caption = image?.caption?.[0]?.plain_text || "";

  if (caption) {
    return `<figure class="notion-image">
  <img src="${imageUrl}" alt="${caption}" loading="lazy" />
  <figcaption>${caption}</figcaption>
</figure>`;
  }

  return `<img src="${imageUrl}" alt="" loading="lazy" class="notion-image" />`;
});

n2m.setCustomTransformer("video", async (block: any) => {
  const { video } = block;
  const videoUrl = video?.file?.url || video?.external?.url;
  const caption = video?.caption?.[0]?.plain_text || "";

  // Handle YouTube videos
  if (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) {
    let videoId = "";
    if (videoUrl.includes("youtube.com/watch")) {
      videoId = videoUrl.split("v=")[1]?.split("&")[0];
    } else if (videoUrl.includes("youtu.be/")) {
      videoId = videoUrl.split("youtu.be/")[1]?.split("?")[0];
    }

    if (videoId) {
      return `<figure class="notion-video">
  <iframe width="100%" height="480" src="https://www.youtube.com/embed/${videoId}"
    title="YouTube video player" frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen></iframe>
  ${caption ? `<figcaption>${caption}</figcaption>` : ''}
</figure>`;
    }
  }

  // Handle other video formats
  return `<figure class="notion-video">
  <video controls>
    <source src="${videoUrl}" type="video/mp4">
    Your browser does not support the video tag.
  </video>
  ${caption ? `<figcaption>${caption}</figcaption>` : ''}
</figure>`;
});

n2m.setCustomTransformer("embed", async (block: any) => {
  const { embed } = block;
  const url = embed?.url;
  const caption = embed?.caption?.[0]?.plain_text || "";

  if (!url) return "";

  return `<figure class="notion-embed">
  <iframe src="${url}" width="100%" height="400" frameborder="0"></iframe>
  ${caption ? `<figcaption>${caption}</figcaption>` : ''}
</figure>`;
});

n2m.setCustomTransformer("code", async (block: any) => {
  const { code } = block;
  const language = code?.language || "text";
  const content = code?.rich_text?.[0]?.plain_text || "";
  const caption = code?.caption?.[0]?.plain_text || "";

  try {
    // Use Prism for syntax highlighting
    const prismLanguage = Prism.languages[language] || Prism.languages.text;
    const highlightedContent = Prism.highlight(content, prismLanguage, language);

    return `<div class="notion-code-block" data-language="${language}">
  <div class="code-header">
    <span class="language-label">${language}</span>
    <button class="copy-button" onclick="copyCodeBlock(this)" aria-label="Copy code">Copy</button>
  </div>
  <div class="code-content">
    <pre><code class="language-${language}">${highlightedContent}</code></pre>
  </div>
  ${caption ? `<figcaption>${caption}</figcaption>` : ''}
</div>`;
  } catch (error) {
    console.warn('Syntax highlighting failed for language:', language, error);
    // Fallback to plain text with basic styling
    const escapedContent = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    return `<div class="notion-code-block" data-language="${language}">
  <div class="code-header">
    <span class="language-label">${language}</span>
    <button class="copy-button" onclick="copyCodeBlock(this)" aria-label="Copy code">Copy</button>
  </div>
  <div class="code-content">
    <pre><code class="language-${language}">${escapedContent}</code></pre>
  </div>
  ${caption ? `<figcaption>${caption}</figcaption>` : ''}
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
      setCacheData(contentCache, cacheKey, noContent, CACHE_CONFIG.PAGE_CONTENT);
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

    // Cache the result
    setCacheData(contentCache, cacheKey, result, CACHE_CONFIG.PAGE_CONTENT);
    return result;
  } catch (error) {
    console.error("Error fetching Notion page content:", error);
    const errorContent = `<div class="error-message">
      <p>Unable to load content from Notion.</p>
      <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
    </div>`;
    // Cache error content for a shorter time to allow retries
    setCacheData(contentCache, cacheKey, errorContent, CACHE_CONFIG.ERROR_CONTENT);
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
    setCacheData(blocksCache, cacheKey, response.results, CACHE_CONFIG.PAGE_BLOCKS);
    return response.results;
  } catch (error) {
    console.error("Error fetching Notion page blocks:", error);
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
