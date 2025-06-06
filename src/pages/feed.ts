import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import getSortedPosts from "@/utils/getSortedPosts";
import { SITE } from "@/config";

/**
 * Generates an RSS feed for the blog.
 *
 * @returns An RSS feed, in XML format.
 */
export async function GET() {
  const posts = await getCollection("blog");
  const sortedPosts = getSortedPosts(posts);
  return rss({
    title: SITE.title,
    description: SITE.desc,
    site: SITE.website,
    items: sortedPosts.map(({ data }) => ({
      link: `blog/${data.slug}`,
      title: data.title,
      description: data.description,
      pubDate: new Date(data.modDatetime ?? data.pubDatetime),
    })),
    trailingSlash: false,
  });
}
