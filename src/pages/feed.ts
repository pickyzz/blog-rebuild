import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { SITE } from "@/config";

// Generate RSS feed using @astrojs/rss, include full HTML in item.content
export async function GET() {
  const MAX_ITEMS = 20;

  const posts = await getCollection("blog", ({ data }) => !data.draft);
  const sorted = posts.sort(
    (a, b) =>
      new Date(b.data.pubDatetime).valueOf() -
      new Date(a.data.pubDatetime).valueOf()
  );
  const limited = sorted.slice(0, MAX_ITEMS);

  const items = limited.map(post => ({
    title: post.data.title,
    link: new URL(`blog/${post.slug}`, SITE.website).toString(),
    pubDate: post.data.pubDatetime,
    description: post.data.description,
    content: post.body,
  }));

  const responsePromise = rss({
    title: SITE.title,
    description: SITE.desc,
    site: SITE.website,
    items,
  });

  const rssResponse = await responsePromise;

  // Add Cache-Control header for SSR caching
  try {
    rssResponse.headers.set(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=300"
    );
  } catch (e) {
    // headers might be immutable in some environments
  }

  return rssResponse;
}
