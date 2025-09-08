import { Client } from "@notionhq/client";
import type { CollectionEntry } from "astro:content";

const NOTION_KEY = import.meta.env.NOTION_KEY;
const DATABASE_ID = import.meta.env.DATABASE_ID;

if (!NOTION_KEY || !DATABASE_ID) {
  throw new Error("Missing Notion environment variables");
}

const notion = new Client({
  auth: NOTION_KEY,
});

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const postsCache = new Map<string, { data: CollectionEntry<"blog">[], timestamp: number }>();
const tagsCache = new Map<string, { data: { tag: string; tagName: string }[], timestamp: number }>();

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
  const cacheKey = 'all_posts';
  const cachedPosts = getCachedData(postsCache, cacheKey);
  if (cachedPosts) {
    return cachedPosts;
  }

  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter: {
        property: "status",
        select: {
          equals: "published",
        },
      },
      sorts: [
        {
          property: "publish_date",
          direction: "descending",
        },
      ],
    });

    const posts: CollectionEntry<"blog">[] = response.results.map((page: any) => {
      const properties = page.properties;

      // Extract data from Notion page properties
      const title = properties.title?.title?.[0]?.plain_text || "Untitled";
      const slug = properties.slug?.rich_text?.[0]?.plain_text || title.toLowerCase().replace(/\s+/g, '-');
      const description = properties.description?.rich_text?.[0]?.plain_text || "";
      const pubDatetime = properties.publish_date?.date?.start || new Date().toISOString();
      const modDatetime = properties.modified_date?.date?.start;
      const featured = properties.featured?.select?.name === "featured" || false;
      const draft = properties.status?.select?.name !== "published";
      const tags = properties.tags?.multi_select?.map((tag: any) => tag.name) || [];
      const author = "Pickyzz"; // Default author
      const readingTime = properties.readingTime?.rich_text?.[0]?.plain_text;
      const canonicalURL = properties.canonicalURL?.url;

      // Extract ogImage from Notion - try multiple sources
      let ogImage = undefined;

      // 1. Try custom ogImage property
      const possibleImageProps = ['ogImage', 'og_image', 'cover', 'image', 'header_image', 'thumbnail'];
      for (const propName of possibleImageProps) {
        if (properties[propName]?.files?.[0]) {
          const file = properties[propName].files[0];
          const imageUrl = file.type === 'external' ? file.external.url : file.file.url;
          ogImage = {
            src: imageUrl,
            width: 1200,
            height: 630,
            format: 'png' as const
          };
          break;
        }
      }

      // 2. Try page cover image if no custom ogImage found
      if (!ogImage && page.cover) {
        let coverUrl = '';
        if (page.cover.type === 'external') {
          coverUrl = page.cover.external.url;
        } else if (page.cover.type === 'file') {
          coverUrl = page.cover.file.url;
        }

        if (coverUrl) {
          ogImage = {
            src: coverUrl,
            width: 1200,
            height: 630,
            format: 'png' as const
          };
        }
      }

      // 3. Try page icon as last resort
      if (!ogImage && page.icon && page.icon.type === 'external') {
        const iconUrl = page.icon.external.url;
        ogImage = {
          src: iconUrl,
          width: 400,
          height: 400,
          format: 'png' as const
        };
      }

      return {
        id: page.id,
        slug,
        data: {
          title,
          slug,
          description,
          pubDatetime: new Date(pubDatetime),
          modDatetime: modDatetime ? new Date(modDatetime) : undefined,
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
        render: () => ({ Content: () => null }), // Placeholder render function
      };
    });

    // Cache the result
    setCacheData(postsCache, cacheKey, posts);
    return posts;
  } catch (error) {
    console.error("Error fetching posts from Notion:", error);
    return [];
  }
}

export async function getNotionPostBySlug(slug: string): Promise<CollectionEntry<"blog"> | null> {
  try {
    const posts = await getNotionPosts();
    return posts.find(post => post.data.slug === slug) || null;
  } catch (error) {
    console.error("Error fetching post by slug:", error);
    return null;
  }
}

export async function getNotionPostsByTag(tagName: string): Promise<CollectionEntry<"blog">[]> {
  try {
    const posts = await getNotionPosts();
    return posts.filter(post => post.data.tags.some((postTag: string) =>
      postTag.toLowerCase().replace(/\s+/g, '-') === tagName.toLowerCase().replace(/\s+/g, '-')
    ));
  } catch (error) {
    console.error("Error fetching posts by tag:", error);
    return [];
  }
}

export async function getNotionUniqueTags(): Promise<{ tag: string; tagName: string }[]> {
  // Check cache first
  const cacheKey = 'unique_tags';
  const cachedTags = getCachedData(tagsCache, cacheKey);
  if (cachedTags) {
    return cachedTags;
  }

  try {
    const posts = await getNotionPosts();
    const tagSet = new Set<string>();

    posts.forEach(post => {
      post.data.tags.forEach(tag => tagSet.add(tag));
    });

    const tags = Array.from(tagSet).map(tag => ({
      tag: tag.toLowerCase().replace(/\s+/g, '-'),
      tagName: tag
    }));

    // Cache the result
    setCacheData(tagsCache, cacheKey, tags);
    return tags;
  } catch (error) {
    console.error("Error fetching unique tags:", error);
    return [];
  }
}
