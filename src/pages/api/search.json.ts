import type { APIRoute } from "astro";
import { getNotionPosts } from "../../utils/getNotionPosts";

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.toLowerCase().trim();

    if (!query) {
      return new Response(JSON.stringify({ posts: [], total: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const posts = await getNotionPosts();

    // Simple search: filter by title, description, and tags
    const filteredPosts = posts.filter(post => {
      const title = post.data.title.toLowerCase();
      const description = post.data.description?.toLowerCase() || "";
      const tags = post.data.tags
        .map((tag: string) => tag.toLowerCase())
        .join(" ");

      return (
        title.includes(query) ||
        description.includes(query) ||
        tags.includes(query)
      );
    });

    return new Response(
      JSON.stringify({
        posts: filteredPosts.slice(0, 50), // Limit to 50 results
        total: filteredPosts.length,
        query,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Search API error:", error);
    return new Response(JSON.stringify({ error: "Search failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
