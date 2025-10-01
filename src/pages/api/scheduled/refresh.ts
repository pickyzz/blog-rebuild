import type { APIRoute } from "astro";
import { invalidateAllCaches } from "@/utils/getNotionPosts";
import { invalidateAllContentCaches } from "@/utils/notionContent";

// Scheduled refresh endpoint for cron jobs or CI/CD
// GET /api/scheduled/refresh
export const GET: APIRoute = async ({ url }) => {
  try {
    // Optional: Add API key authentication for scheduled calls
    const apiKey = url.searchParams.get("key");
    const expectedKey = import.meta.env.SCHEDULED_REFRESH_KEY;

    if (expectedKey && apiKey !== expectedKey) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid API key",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Invalidate all caches
    invalidateAllCaches();
    invalidateAllContentCaches();

    console.log(
      "[SCHEDULED REFRESH] All caches invalidated via scheduled job at",
      new Date().toISOString()
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Cache refreshed via scheduled job",
        timestamp: new Date().toISOString(),
        nextSuggestedRefresh: new Date(
          Date.now() + 5 * 60 * 1000
        ).toISOString(), // 5 minutes from now
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[SCHEDULED REFRESH ERROR]", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Failed to refresh cache",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

// POST also supported for consistency
export const POST: APIRoute = async context => {
  return GET(context);
};
