import { z } from 'zod';

export const SearchItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string(),
  pubDatetime: z.string().nullable(),
  modDatetime: z.string().nullable(),
  featured: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  readingTime: z.any().nullable().optional(),
  score: z.number().optional(),
  matches: z.any().optional(),
});

export const SearchResponseSchema = z.object({
  posts: z.array(SearchItemSchema),
  total: z.number(),
  hasMore: z.boolean().optional(),
  query: z.string(),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
    currentPage: z.number(),
    totalPages: z.number(),
  }).optional(),
  suggestions: z.any().optional(),
});

export default SearchResponseSchema;
