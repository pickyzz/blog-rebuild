import type { APIRoute } from "astro";
import { invalidateCache, CacheKeys } from "@/utils/cache/kv-cache";
import { authenticateRequest } from "@/utils/apiAuth";

export const POST: APIRoute = async ({ params, request }) => {
  try {
    // Authenticate the request
    const authResult = authenticateRequest(request);
    if (!authResult.success) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const path = params.path;
    if (!path || path.length === 0) {
      return new Response(JSON.stringify({ error: "Path is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const fullPath = path.join("/");
    let invalidatedKeys: string[] = [];

    // Invalidate cache based on path pattern
    switch (fullPath) {
      case "all":
        // Invalidate all Notion-related cache
        const removedAll = invalidateCache("notion");
        invalidatedKeys = [`notion:* (${removedAll} keys removed)`];
        break;

      case "posts":
        invalidateCacheKey(CacheKeys.allPosts());
        invalidatedKeys = [CacheKeys.allPosts()];
        break;

      case "tags":
        invalidateCacheKey(CacheKeys.allTags());
        invalidatedKeys = [CacheKeys.allTags()];
        break;

      default:
        if (fullPath.startsWith("posts/tag/")) {
          const tag = fullPath.replace("posts/tag/", "");
          invalidateCacheKey(CacheKeys.postsByTag(tag));
          invalidatedKeys = [CacheKeys.postsByTag(tag)];
        } else if (fullPath.startsWith("post/")) {
          const slug = fullPath.replace("post/", "");
          invalidateCacheKey(CacheKeys.postBySlug(slug));
          invalidatedKeys = [CacheKeys.postBySlug(slug)];
        } else {
          return new Response(
            JSON.stringify({ error: "Invalid path pattern" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cache invalidated for: ${fullPath}`,
        invalidatedKeys,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Cache invalidation error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      message: "Redis Cache Invalidation API",
      usage: {
        "POST /api/revalidate/all": "Invalidate all cache",
        "POST /api/revalidate/posts": "Invalidate posts cache",
        "POST /api/revalidate/tags": "Invalidate tags cache",
        "POST /api/revalidate/post/{slug}": "Invalidate specific post cache",
        "POST /api/revalidate/posts/tag/{tag}": "Invalidate posts by tag cache",
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
};
