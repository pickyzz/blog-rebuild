import { slugifyStr } from "./slugify";
import type { CollectionEntry } from "astro:content";

export const getReadingTime = async () => {
  const globPosts = Object.values(
    import.meta.glob<CollectionEntry<"blog">>("../content/blog/*{.mdx,.md}", {
      eager: false,
    })
  );

  const mapFrontmatter = new Map<string, number>();
  const globPostsValues = Object.values(globPosts);
  await Promise.all(
    globPostsValues.map(async globPost => {
      const { frontmatter }: any = await globPost();
      mapFrontmatter.set(
        slugifyStr(frontmatter.title),
        frontmatter.readingTime
      );
    })
  );

  return mapFrontmatter;
};

const getPostsWithRT = async (posts: CollectionEntry<"blog">[]) => {
  const mapFrontmatter = await getReadingTime();

  return posts.map(post => {
    post.data.readingTime = String(
      mapFrontmatter.get(slugifyStr(post.data.title))
    );
    return post;
  });
};

export default getPostsWithRT;
