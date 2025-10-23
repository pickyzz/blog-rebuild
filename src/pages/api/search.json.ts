import type { APIRoute } from "astro";
import { getNotionPosts } from "../../utils/getNotionPosts";
import { withUpstashRateLimit } from "../../utils/ratelimit/upstashRatelimit";
import { BlogSearch, SearchCache } from "@/utils/searchUtils";
import formatSearchResult from "./search.formatters.js";
import { SearchResponseSchema } from "./search.schema.js";

// Global search cache (in production, consider Redis)
const searchCache = new SearchCache(10 * 60 * 1000); // 10 minutes TTL

// Global posts cache to avoid refetching
let cachedPosts: any[] | null = null;
let postsCacheTime = 0;
const POSTS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedPosts() {
  const now = Date.now();
  if (cachedPosts && now - postsCacheTime < POSTS_CACHE_TTL) {
    return cachedPosts;
  }

  cachedPosts = await getNotionPosts();
  postsCacheTime = now;
  return cachedPosts;
}

export const GET: APIRoute = withUpstashRateLimit(async ({ request }) => {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim();
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50); // Max 50
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);
    const includeSuggestions = url.searchParams.get("suggestions") === "true";

    if (!query) {
      // Return suggestions if requested
      if (includeSuggestions) {
        const posts = await getCachedPosts();
        const search = new BlogSearch(posts);
        const suggestions = search.getSuggestions();

        return new Response(
          JSON.stringify({
            posts: [],
            total: 0,
            suggestions,
            query: "",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          posts: [],
          total: 0,
          query: "",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Create cache key
    const cacheKey = `${query}_${limit}_${offset}_${includeSuggestions}`;

    // Check cache first
    const cachedResult = searchCache.get(cacheKey);
    if (cachedResult) {
      return new Response(JSON.stringify(cachedResult), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get posts and perform search
    const posts = await getCachedPosts();
    const search = new BlogSearch(posts);

    const searchResult = search.search({
      query,
      limit,
      offset,
      minScore: 0.3, // Minimum relevance score - increased to filter irrelevant results
    });

    // Format results for API response using centralized formatter
    const formattedResults = searchResult.results.map(result => formatSearchResult(result));

    const response = {
      posts: formattedResults,
      total: searchResult.total,
      hasMore: searchResult.hasMore,
      query: searchResult.query,
      pagination: {
        limit,
        offset,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(searchResult.total / limit),
      },
      ...(includeSuggestions && { suggestions: search.getSuggestions() }),
    };

    // Validate the response shape before returning
    const parseResult = SearchResponseSchema.safeParse(response);
    if (!parseResult.success) {
      // validation failed - do not expose internal details
      console.error("Search response validation failed");
      return new Response(
        JSON.stringify({ error: "Search response shape invalid" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Cache the result
    searchCache.set(cacheKey, response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Search API error:", error);
    return new Response(
      JSON.stringify({
        error: "Search failed",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}, "MODERATE"); // Moderate rate limiting for search using Upstash
