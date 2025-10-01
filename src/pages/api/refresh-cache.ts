import type { APIRoute } from "astro";
import { invalidateAllCaches } from "@/utils/getNotionPosts";
import { invalidateAllContentCaches } from "@/utils/notionContent";

// POST /api/refresh-cache
export const POST: APIRoute = async () => {
  try {
    // Invalidate all caches
    invalidateAllCaches();
    invalidateAllContentCaches();

    console.log(
      "[CACHE REFRESH] All caches invalidated at",
      new Date().toISOString()
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "All caches invalidated successfully",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("[CACHE REFRESH ERROR]", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Failed to invalidate caches",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};

// GET /api/refresh-cache for convenience (though POST is preferred for actions)
export const GET: APIRoute = async () => {
  // Redirect to POST for proper semantics, but allow GET for easy browser testing
  return new Response("Use POST method for cache refresh", {
    status: 405,
    headers: {
      Allow: "POST",
    },
  });
};
