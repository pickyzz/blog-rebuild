/**
 * ISR (Incremental Static Regeneration) utilities for Astro
 * Provides getStaticPaths for dynamic routes with Notion data
 */

import { getNotionPosts, getNotionUniqueTags } from "../getNotionPosts";

/**
 * Generate static paths for blog posts
 * Used by src/pages/blog/[slug]/index.astro
 */
export async function getPostPaths() {
  try {
    const posts = await getNotionPosts();
    const publishedPosts = posts.filter(post => !post.data.draft);

    return publishedPosts.map(post => ({
      params: { slug: post.data.slug },
      props: { post },
    }));
  } catch (error) {
    console.error("Error generating post paths:", error);
    return [];
  }
}

/**
 * Generate static paths for blog pagination
 * Used by src/pages/blog/page/[page].astro
 */
export async function getBlogPaths() {
  try {
    const posts = await getNotionPosts();
    const publishedPosts = posts.filter(post => !post.data.draft);
    const { SITE } = await import("@/config");

    const pageSize = SITE.postPerPage || 10;
    const totalPages = Math.max(1, Math.ceil(publishedPosts.length / pageSize));

    const paths = [];

    // Generate paths for each page (starting from page 2 since page 1 is handled by /blog/index.astro)
    for (let page = 2; page <= totalPages; page++) {
      const start = (page - 1) * pageSize;
      const end = Math.min(start + pageSize, publishedPosts.length);
      const pageData = publishedPosts.slice(start, end);

      paths.push({
        params: { page: page.toString() },
        props: {
          totalPages,
          posts: pageData,
          currentPage: page,
          start: start + 1,
          end: end,
          total: publishedPosts.length,
          size: pageSize,
          url: `/blog/page/${page}`,
          prev: page === 2 ? "/blog" : `/blog/page/${page - 1}`,
          next: page < totalPages ? `/blog/page/${page + 1}` : undefined,
        },
      });
    }

    return paths;
  } catch (error) {
    console.error("Error generating blog paths:", error);
    // Return empty array if error occurs
    return [];
  }
}

/**
 * Generate static paths for tag pages
 * Used by src/pages/tags/[tag]/index.astro if needed
 */
export async function getTagPaths() {
  try {
    const tags = await getNotionUniqueTags();

    return tags.map(tag => ({
      params: { tag: tag.tag },
      props: { tag: tag },
    }));
  } catch (error) {
    console.error("Error generating tag paths:", error);
    return [];
  }
}

/**
 * Helper function to get static props for ISR
 * Combines data fetching with caching
 */
export async function getStaticProps<T>(
  key: string,
  fetcher: () => Promise<T>,
  revalidate: number = 1800
): Promise<{ props: T; revalidate: number }> {
  try {
    const data = await fetcher();
    return {
      props: data,
      revalidate,
    };
  } catch (error) {
    console.error(`Error fetching static props for ${key}:`, error);
    throw error;
  }
}

/**
 * ISR configuration for different page types
 */
export const ISR_CONFIG = {
  // 30 minutes for blog posts
  POST: 1800,
  // 1 hour for blog listings
  BLOG: 3600,
  // 2 hours for tags
  TAG: 7200,
  // 30 minutes for homepage
  HOME: 1800,
} as const;

/**
 * Validate that required environment variables are set for ISR
 */
export function validateISREnvironment(): {
  valid: boolean;
  missing: string[];
} {
  const required = ["NOTION_KEY", "DATABASE_ID"];
  const missing = required.filter(
    key => !import.meta.env[key] || import.meta.env[key].trim() === ""
  );

  return {
    valid: missing.length === 0,
    missing,
  };
}
