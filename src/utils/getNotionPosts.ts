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

      // Debug: Log all available properties
      console.log('Available properties:', Object.keys(properties));
      console.log('Page properties:', Object.keys(properties).map(key => ({ [key]: properties[key]?.type })));

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
          console.log(`Found image in property "${propName}":`, imageUrl);
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
          console.log(`Found cover image:`, coverUrl);
        }
      }

      console.log(`Post "${title}": ogImage =`, ogImage?.src || 'No ogImage');

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

    return posts;
  } catch (error) {
    console.error("Error fetching posts from Notion:", error);
    return [];
  }
}
