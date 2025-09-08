import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeRaw from 'rehype-raw';

const NOTION_KEY = import.meta.env.NOTION_KEY;

if (!NOTION_KEY) {
  throw new Error("Missing NOTION_KEY environment variable");
}

const notion = new Client({
  auth: NOTION_KEY,
});

// Cache configuration
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes for content (longer than posts)
const contentCache = new Map<string, { data: string, timestamp: number }>();
const blocksCache = new Map<string, { data: any[], timestamp: number }>();

// Helper function to check if cache is valid
function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_TTL;
}

// Helper function to get cached data or null if expired
function getCachedData<T>(cache: Map<string, { data: T, timestamp: number }>, key: string): T | null {
  const cached = cache.get(key);
  if (cached && isCacheValid(cached.timestamp)) {
    return cached.data;
  }
  if (cached) {
    cache.delete(key); // Remove expired cache
  }
  return null;
}

// Helper function to set cache data
function setCacheData<T>(cache: Map<string, { data: T, timestamp: number }>, key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
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

  return `<div class="notion-code-block">
  <pre><code class="language-${language}">${content}</code></pre>
  ${caption ? `<figcaption>${caption}</figcaption>` : ''}
</div>`;
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
      setCacheData(contentCache, cacheKey, noContent);
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
    setCacheData(contentCache, cacheKey, result);
    return result;
  } catch (error) {
    console.error("Error fetching Notion page content:", error);
    const errorContent = `<div class="error-message">
      <p>Unable to load content from Notion.</p>
      <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
    </div>`;
    // Cache error content for a shorter time to allow retries
    setCacheData(contentCache, cacheKey, errorContent);
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
    setCacheData(blocksCache, cacheKey, response.results);
    return response.results;
  } catch (error) {
    console.error("Error fetching Notion page blocks:", error);
    // Cache empty array for errors to avoid repeated failed requests
    setCacheData(blocksCache, cacheKey, []);
    return [];
  }
}
