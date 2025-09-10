import rss from "@astrojs/rss";
import { getNotionPosts } from "@/utils/getNotionPosts";
import { getNotionPageContent } from "@/utils/notionContent";
import getSortedPosts from "@/utils/getSortedPosts";
import { SITE } from "@/config";

// Generate RSS feed using @astrojs/rss, include full sanitized HTML in item.content
export async function GET() {
  const MAX_ITEMS = 20;

  const posts = await getNotionPosts();
  const published = (posts as any[]).filter((p: any) => !p?.data?.draft);
  const sorted = getSortedPosts(published as any) as any[];
  const limited = (sorted || []).slice(0, MAX_ITEMS);

  const items: any[] = [];
  for (const post of limited) {
    try {
      const html = await getNotionPageContent(post.id);
      items.push({
        title: post.data?.title ?? "",
        link: new URL(`blog/${post.data?.slug}`, SITE.website).toString(),
        pubDate: new Date(post.data?.modDatetime ?? post.data?.pubDatetime),
        description: post.data?.description ?? "",
        content: String(html ?? ""),
      });
    } catch (err) {
      console.error("[RSS] Failed to fetch content for post:", post?.id, err);
    }
  }

  const responsePromise = rss({
    title: SITE.title,
    description: SITE.desc,
    site: SITE.website,
    items,
  });

  const rssResponse = await responsePromise;

  // Add Cache-Control header for SSR caching
  try {
    rssResponse.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=300");
  } catch (e) {
    // headers might be immutable in some environments
  }

  return rssResponse;
}
