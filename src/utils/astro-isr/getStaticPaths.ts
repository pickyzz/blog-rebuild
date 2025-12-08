/**
 * Static path generation for SSG mode using content collections
 * Replaces ISR utilities for static generation
 */

import { getCollection } from "astro:content";

/**
 * Generate static paths for blog posts
 * Used by src/pages/blog/[slug]/index.astro
 */
export async function getPostPaths() {
  try {
    const posts = await getCollection("blog", ({ data }) => !data.draft);

    return posts.map(post => ({
      params: { slug: post.slug }, // Use post.slug from content collections
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
    const posts = await getCollection("blog", ({ data }) => !data.draft);
    const { SITE } = await import("@/config");

    const pageSize = SITE.postPerPage || 10;
    const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));

    const paths = [];

    // Generate paths for pages 2+ (page 1 is handled by /blog/index.astro)
    for (let page = 2; page <= totalPages; page++) {
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const pagePosts = posts.slice(startIndex, endIndex);

      paths.push({
        params: { page: page.toString() },
        props: {
          posts: pagePosts,
          currentPage: page,
          totalPages,
          start: startIndex + 1,
          end: Math.min(endIndex, posts.length),
          total: posts.length,
          size: pageSize,
          url: `/blog/page/${page}`,
          prev: page > 2 ? `/blog/page/${page - 1}` : "/blog",
          next: page < totalPages ? `/blog/page/${page + 1}` : undefined,
        },
      });
    }

    return paths;
  } catch (error) {
    console.error("Error generating blog paths:", error);
    return [];
  }
}

/**
 * Generate static paths for tag pages
 * Used by src/pages/tags/[tag]/[...page].astro
 */
export async function getTagPaths() {
  try {
    const posts = await getCollection("blog", ({ data }) => !data.draft);
    const { SITE } = await import("@/config");

    const pageSize = SITE.postPerPage || 10;

    // Get all unique tags
    const tagMap = new Map<string, any[]>();

    posts.forEach(post => {
      post.data.tags.forEach((tag: string) => {
        if (!tagMap.has(tag)) {
          tagMap.set(tag, []);
        }
        tagMap.get(tag)!.push(post);
      });
    });

    const paths = [];

    for (const [tag, tagPosts] of tagMap.entries()) {
      const sortedPosts = tagPosts.sort(
        (a, b) =>
          new Date(b.data.pubDatetime).valueOf() -
          new Date(a.data.pubDatetime).valueOf()
      );
      const totalPages = Math.max(1, Math.ceil(sortedPosts.length / pageSize));

      // Generate all pages for this tag
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const startIndex = (pageNum - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const pagePosts = sortedPosts.slice(startIndex, endIndex);

        if (pageNum === 1) {
          // First page uses /tags/[tag] path
          paths.push({
            params: { tag },
            props: {
              posts: pagePosts,
              currentPage: pageNum,
              totalPages,
              start: startIndex + 1,
              end: Math.min(endIndex, sortedPosts.length),
              total: sortedPosts.length,
              size: pageSize,
              url: `/tags/${tag}`,
              prev: undefined,
              next: totalPages > 1 ? `/tags/${tag}/2` : undefined,
            },
          });
        } else {
          // Additional pages use /tags/[tag]/[page] path
          paths.push({
            params: { tag, page: pageNum.toString() },
            props: {
              posts: pagePosts,
              currentPage: pageNum,
              totalPages,
              start: startIndex + 1,
              end: Math.min(endIndex, sortedPosts.length),
              total: sortedPosts.length,
              size: pageSize,
              url: `/tags/${tag}/${pageNum}`,
              prev:
                pageNum > 2 ? `/tags/${tag}/${pageNum - 1}` : `/tags/${tag}`,
              next:
                pageNum < totalPages
                  ? `/tags/${tag}/${pageNum + 1}`
                  : undefined,
            },
          });
        }
      }
    }

    return paths;
  } catch (error) {
    console.error("Error generating tag paths:", error);
    return [];
  }
}
