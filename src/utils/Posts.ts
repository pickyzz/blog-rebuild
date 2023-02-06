import type { BlogFrontmatter, MarkdownInstance } from '@/components';

export const sortByDate = (posts: MarkdownInstance<BlogFrontmatter>[]) => {
  return posts.sort(
    (a, b) =>
      new Date(b.frontmatter.pubDate).valueOf() -
      new Date(a.frontmatter.pubDate).valueOf()
  );
};
