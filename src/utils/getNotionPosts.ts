import { Client } from "@notionhq/client";
import type { BlogPost } from "@/types";
import type { CollectionEntry } from "astro:content";
import { ensureDate } from "./ensureDate";
import { throttleNotion } from "./notionRateLimiter";

const NOTION_KEY = import.meta.env.NOTION_KEY;
const DATABASE_ID = import.meta.env.DATABASE_ID;

if (!NOTION_KEY || !DATABASE_ID) {
  throw new Error("Missing Notion environment variables");
}

const notion = new Client({
  auth: NOTION_KEY,
});

// TTL Configuration for different content types (in milliseconds) - configurable via env vars for development flexibility
const CACHE_CONFIG = {
  POSTS: parseInt(
    import.meta.env.POSTS_CACHE_TTL ||
      (import.meta.env.NODE_ENV === "development" ? "30000" : "120000")
  ), // 30s dev, 2min prod
  TAGS: parseInt(import.meta.env.TAGS_CACHE_TTL || "600000"), // 10 minutes
  POST_BY_SLUG_NEW: parseInt(
    import.meta.env.POST_BY_SLUG_NEW_CACHE_TTL || "120000"
  ), // 2 minutes
  POST_BY_SLUG_OLD: parseInt(
    import.meta.env.POST_BY_SLUG_OLD_CACHE_TTL || "900000"
  ), // 15 minutes
  POSTS_BY_TAG: parseInt(import.meta.env.POSTS_BY_TAG_CACHE_TTL || "300000"), // 5 minutes
} as const;

const postsCache = new Map<
  string,
  { data: BlogPost[]; timestamp: number; ttl: number }
>();
const tagsCache = new Map<
  string,
  { data: { tag: string; tagName: string }[]; timestamp: number; ttl: number }
>();
const postBySlugCache = new Map<
  string,
  { data: BlogPost | null; timestamp: number; ttl: number }
>();
const postsByTagCache = new Map<
  string,
  { data: BlogPost[]; timestamp: number; ttl: number }
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

/**
 * Retry helper with exponential backoff for Notion API requests.
 * Retries on 429 (rate limit) or 5xx errors.
 * Logs every retry and error.
 */
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 4,
  baseDelay = 1000
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      // Ensure we respect Notion's rate limit
      try {
        await throttleNotion();
      } catch (e) {
        // swallow throttler errors and proceed
      }
      return await fn();
    } catch (error: any) {
      const status = error?.status || error?.code || error?.response?.status;
      const isRetryable =
        status === 429 ||
        (typeof status === "number" && status >= 500 && status < 600);

      if (!isRetryable || attempt >= maxRetries) {
        console.error(`[NOTION API ERROR] Attempt ${attempt + 1}:`, error);
        throw error;
      }

      const delay =
        baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 300);
      console.warn(
        `[NOTION API RETRY] Attempt ${attempt + 1} failed (status: ${status}). Retrying in ${delay}ms...`
      );
      await new Promise(res => setTimeout(res, delay));
      attempt++;
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

export interface NotionPost {
  id: string;
  title: string;
  slug: string;
  description: string;
  pubDatetime: string;
  modDatetime?: string;
  featured: boolean;
  draft: boolean;
  tags: string[];
  author: string;
  readingTime?: string;
  canonicalURL?: string;
}

export async function getNotionPosts(): Promise<CollectionEntry<"blog">[]> {
  // Check cache first
  const cacheKey = "all_posts";
  const cachedPosts = getCachedData(postsCache, cacheKey);
  if (cachedPosts) {
    return cachedPosts;
  }

  try {
    // Fetch all pages using pagination (Notion returns a page at a time)
    const params: any = {
      database_id: DATABASE_ID,
      filter: {
        property: "status",
        select: { equals: "published" },
      },
      sorts: [
        { property: "publish_date", direction: "descending" },
      ],
      page_size: 100,
    };

    let allResults: any[] = [];
    while (true) {
      const res = await fetchWithRetry(() => notion.databases.query(params));
      allResults = allResults.concat(res.results || []);
      if (!res.has_more) break;
      params.start_cursor = res.next_cursor;
    }

    const posts: CollectionEntry<"blog">[] = allResults.map((page: any) => {
      const properties = page.properties;

        // Extract data from Notion page properties
        const title = properties.title?.title?.[0]?.plain_text || "Untitled";
        const slug =
          properties.slug?.rich_text?.[0]?.plain_text ||
          title.toLowerCase().replace(/\s+/g, "-");
        const description =
          properties.description?.rich_text?.[0]?.plain_text || "";
        const pubDatetimeRaw = properties.publish_date?.date?.start || new Date().toISOString();
        const modDatetimeRaw = properties.modified_date?.date?.start;
        const featured =
          properties.featured?.select?.name === "featured" || false;
        const draft = properties.status?.select?.name !== "published";
        const tags =
          properties.tags?.multi_select?.map((tag: any) => tag.name) || [];
        const author = "Pickyzz"; // Default author
        const readingTime = properties.readingTime?.rich_text?.[0]?.plain_text;
        const canonicalURL = properties.canonicalURL?.url;

        // Extract ogImage from Notion - try multiple sources
        let ogImage = undefined;

        // 1. Try custom ogImage property
        const possibleImageProps = [
          "ogImage",
          "og_image",
          "cover",
          "image",
          "header_image",
          "thumbnail",
        ];
        for (const propName of possibleImageProps) {
          if (properties[propName]?.files?.[0]) {
            const file = properties[propName].files[0];
            const imageUrl =
              file.type === "external" ? file.external.url : file.file.url;
            ogImage = {
              src: imageUrl,
              width: 1200,
              height: 630,
              format: "png" as const,
            };
            break;
          }
        }

        // 2. Try page cover image if no custom ogImage found
        if (!ogImage && page.cover) {
          let coverUrl = "";
          if (page.cover.type === "external") {
            coverUrl = page.cover.external.url;
          } else if (page.cover.type === "file") {
            coverUrl = page.cover.file.url;
          }

          if (coverUrl) {
            ogImage = {
              src: coverUrl,
              width: 1200,
              height: 630,
              format: "png" as const,
            };
          }
        }

        // 3. Try page icon as last resort
        if (!ogImage && page.icon && page.icon.type === "external") {
          const iconUrl = page.icon.external.url;
          ogImage = {
            src: iconUrl,
            width: 400,
            height: 400,
            format: "png" as const,
          };
        }

        return {
          id: page.id,
          slug,
          data: {
            title,
            slug,
            description,
            pubDatetime: ensureDate(pubDatetimeRaw) ?? new Date(),
            modDatetime: ensureDate(modDatetimeRaw),
            featured,
            draft,
            tags,
            author,
            readingTime,
            canonicalURL,
            ogImage,
          },
          body: "", // Notion content will be fetched separately if needed
          collection: "blog",
          render: async () => ({ Content: () => null }), // Placeholder render function
        };
      }
    );

    // Cache the result
    setCacheData(postsCache, cacheKey, posts, CACHE_CONFIG.POSTS);
    return posts;
  } catch (error) {
    console.error("Error fetching posts from Notion:", error);
    return [];
  }
}

export async function getNotionPostBySlug(
  slug: string
): Promise<CollectionEntry<"blog"> | null> {
  // Check cache first
  const cacheKey = `post_${slug}`;
  const cachedPost = getCachedData(postBySlugCache, cacheKey);
  if (cachedPost !== null) {
    console.info(`[CACHE HIT] postBySlug: ${slug}`);
    return cachedPost;
  }
  console.info(`[CACHE MISS] postBySlug: ${slug}`);

  try {
    // Query Notion directly for the specific slug to avoid fetching all posts
    const params: any = {
      database_id: DATABASE_ID,
      filter: {
        and: [
          { property: "slug", rich_text: { equals: slug } },
          { property: "status", select: { equals: "published" } },
        ],
      },
      page_size: 1,
    };

  const res = await fetchWithRetry(() => notion.databases.query(params));
  const page = (res.results && res.results[0]) as any;
    const post = page
      ? {
          id: page.id,
          slug,
          data: {
            title:
              page.properties.title?.title?.[0]?.plain_text || "Untitled",
            slug,
            description:
              page.properties.description?.rich_text?.[0]?.plain_text || "",
            pubDatetime:
              ensureDate(page.properties.publish_date?.date?.start) ?? new Date(),
            modDatetime: ensureDate(page.properties.modified_date?.date?.start),
            featured:
              page.properties.featured?.select?.name === "featured" || false,
            draft: page.properties.status?.select?.name !== "published",
            tags:
              page.properties.tags?.multi_select?.map((t: any) => t.name) || [],
            author: "Pickyzz",
            readingTime: page.properties.readingTime?.rich_text?.[0]?.plain_text,
            canonicalURL: page.properties.canonicalURL?.url,
            // Determine ogImage from multiple possible Notion sources (property files, page cover, icon)
            ogImage: (() => {
              try {
                let og = undefined;
                const properties = page.properties || {};
                const possibleImageProps = [
                  "ogImage",
                  "og_image",
                  "cover",
                  "image",
                  "header_image",
                  "thumbnail",
                ];
                for (const propName of possibleImageProps) {
                  if (properties[propName]?.files?.[0]) {
                    const file = properties[propName].files[0];
                    const imageUrl =
                      file.type === "external" ? file.external.url : file.file.url;
                    og = {
                      src: imageUrl,
                      width: 1200,
                      height: 630,
                      format: "png" as const,
                    };
                    break;
                  }
                }

                if (!og && page.cover) {
                  let coverUrl = "";
                  if (page.cover.type === "external") {
                    coverUrl = page.cover.external.url;
                  } else if (page.cover.type === "file") {
                    coverUrl = page.cover.file.url;
                  }
                  if (coverUrl) {
                    og = { src: coverUrl, width: 1200, height: 630, format: "png" as const };
                  }
                }

                if (!og && page.icon && page.icon.type === "external") {
                  const iconUrl = page.icon.external.url;
                  og = { src: iconUrl, width: 400, height: 400, format: "png" as const };
                }
                return og;
              } catch (e) {
                return undefined;
              }
            })(),
          },
          body: "",
          collection: "blog",
          render: async () => ({ Content: () => null }),
        }
      : null;

    // Smart TTL: use shorter cache for recent posts
    let ttl = CACHE_CONFIG.POST_BY_SLUG_OLD;
    if (post && post.data && post.data.pubDatetime) {
      const pubDate = post.data.pubDatetime; // Already a Date instance
      const now = new Date();
      const diffMinutes = (now.getTime() - pubDate.getTime()) / (1000 * 60);
      if (diffMinutes < 60 * 24) {
        ttl = CACHE_CONFIG.POST_BY_SLUG_NEW;
      }
    }
    setCacheData(postBySlugCache, cacheKey, post, ttl);
    return post;
  } catch (error) {
    console.error("Error fetching post by slug:", error);
    // Cache null result for failed requests to avoid repeated API calls
    setCacheData(
      postBySlugCache,
      cacheKey,
      null,
      CACHE_CONFIG.POST_BY_SLUG_OLD / 4
    ); // Shorter TTL for errors
    return null;
  }
}

export async function getNotionPostsByTag(
  tagName: string
): Promise<CollectionEntry<"blog">[]> {
  // Check cache first
  const cacheKey = `posts_tag_${tagName}`;
  const cachedPosts = getCachedData(postsByTagCache, cacheKey);
  if (cachedPosts) {
    return cachedPosts;
  }

  try {
    const posts = await getNotionPosts();
    const filteredPosts = posts.filter(post =>
      post.data.tags.some(
        (postTag: string) =>
          postTag.toLowerCase().replace(/\s+/g, "-") ===
          tagName.toLowerCase().replace(/\s+/g, "-")
      )
    );

    // Cache the result
    setCacheData(
      postsByTagCache,
      cacheKey,
      filteredPosts,
      CACHE_CONFIG.POSTS_BY_TAG
    );
    return filteredPosts;
  } catch (error) {
    console.error("Error fetching posts by tag:", error);
    // Cache empty array for failed requests to avoid repeated API calls
    setCacheData(postsByTagCache, cacheKey, [], CACHE_CONFIG.POSTS_BY_TAG / 4); // Shorter TTL for errors
    return [];
  }
}

export async function getNotionUniqueTags(): Promise<
  { tag: string; tagName: string }[]
> {
  // Check cache first
  const cacheKey = "unique_tags";
  const cachedTags = getCachedData(tagsCache, cacheKey);
  if (cachedTags) {
    return cachedTags;
  }

  try {
    const posts = await getNotionPosts();
    const tagSet = new Set<string>();

    posts.forEach(post => {
      post.data.tags.forEach((tag: string) => tagSet.add(tag));
    });

    const tags = Array.from(tagSet).map(tag => ({
      tag: tag.toLowerCase().replace(/\s+/g, "-"),
      tagName: tag,
    }));

    // Cache the result
    setCacheData(tagsCache, cacheKey, tags, CACHE_CONFIG.TAGS);
    return tags;
  } catch (error) {
    console.error("Error fetching unique tags:", error);
    return [];
  }
}

// Cache management functions
export function invalidateAllCaches(): void {
  postsCache.clear();
  tagsCache.clear();
  postBySlugCache.clear();
  postsByTagCache.clear();
}

export function invalidatePostCaches(): void {
  postsCache.clear();
  postBySlugCache.clear();
  postsByTagCache.clear();
  // Also clear tags cache as it depends on posts
  tagsCache.clear();
}

export function invalidatePostBySlug(slug: string): void {
  const cacheKey = `post_${slug}`;
  invalidateCache(postBySlugCache, cacheKey);
}

export function invalidatePostsByTag(tagName: string): void {
  const cacheKey = `posts_tag_${tagName}`;
  invalidateCache(postsByTagCache, cacheKey);
}

export function getCacheStatistics(): {
  posts: { size: number; keys: string[] };
  tags: { size: number; keys: string[] };
  postBySlug: { size: number; keys: string[] };
  postsByTag: { size: number; keys: string[] };
} {
  return {
    posts: getCacheStats(postsCache),
    tags: getCacheStats(tagsCache),
    postBySlug: getCacheStats(postBySlugCache),
    postsByTag: getCacheStats(postsByTagCache),
  };
}

export function cleanupExpiredCaches(): void {
  clearExpiredCache(postsCache);
  clearExpiredCache(tagsCache);
  clearExpiredCache(postBySlugCache);
  clearExpiredCache(postsByTagCache);
}
