import type { APIRoute } from "astro";
import { invalidateAllCaches } from "@/utils/getNotionPosts";
import { invalidateAllContentCaches } from "@/utils/notionContent";
import { withAuth } from "@/utils/apiAuth";
import { withRateLimit, RATE_LIMITS } from "@/utils/apiSecurity";

// POST /api/refresh-cache with authentication and rate limiting
export const POST: APIRoute = withRateLimit(
  withAuth(async context => {
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
  }),
  RATE_LIMITS.SENSITIVE // Strict rate limiting for cache operations
);

// GET method not allowed for cache refresh operations
export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      success: false,
      message: "Method not allowed. Use POST with API key authentication.",
      allowedMethods: ["POST"],
    }),
    {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        Allow: "POST",
      },
    }
  );
};
