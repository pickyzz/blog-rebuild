// TypeScript interfaces and zod schema for Notion page validation

import { z } from "zod";

// Type for Notion tag
export interface NotionTag {
  id: string;
  name: string;
  color?: string;
}

// Main Notion page interface (matches the mapped object in notion.js)
export interface NotionPage {
  id: string;
  title: string;
  type: string;
  cover?: string | null;
  tags: NotionTag[];
  created_time: string;
  last_edited_time: string;
  featured?: string | null;
  archived: boolean;
  status?: string | null;
  publish_date?: string | null;
  modified_date?: string | null;
  description?: string | null;
  slug: string;
}

// Zod schema for NotionTag
export const NotionTagSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
});

// Zod schema for NotionPage
export const NotionPageSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  cover: z.string().nullable().optional(),
  tags: z.array(NotionTagSchema),
  created_time: z.string(),
  last_edited_time: z.string(),
  featured: z.string().nullable().optional(),
  archived: z.boolean(),
  status: z.string().nullable().optional(),
  publish_date: z.string().nullable().optional(),
  modified_date: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  slug: z.string(),
});
