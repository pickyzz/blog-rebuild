import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    notionId: z.string().optional(), // Notion page ID for content fetching
    title: z.string(),
    description: z.string(),
    pubDatetime: z.date(),
    modDatetime: z.date().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    author: z.string().default("Pickyzz"),
    readingTime: z.string().optional(),
    canonicalURL: z.string().url().optional(),
    ogImage: z.string().optional(), // Accept both URLs and local paths
  }),
});

export const collections = {
  blog,
};
