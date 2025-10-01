import type { APIRoute } from "astro";
import { invalidateAllCaches } from "@/utils/getNotionPosts";
import { invalidateAllContentCaches } from "@/utils/notionContent";

// Webhook endpoint for Notion (or other external services)
// POST /api/webhook/refresh
export const POST: APIRoute = async ({ request }) => {
  try {
    // Optional: Add webhook verification/authentication
    const authHeader = request.headers.get("authorization");
    const expectedToken = import.meta.env.WEBHOOK_SECRET;

    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Unauthorized",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Parse webhook payload (optional - can be used for selective cache invalidation)
    let payload = null;
    try {
      payload = await request.json();
    } catch {
      // Ignore JSON parse errors - proceed with full cache refresh
    }

    // Invalidate all caches
    invalidateAllCaches();
    invalidateAllContentCaches();

    console.log(
      "[WEBHOOK REFRESH] All caches invalidated via webhook at",
      new Date().toISOString()
    );
    if (payload) {
      console.log("[WEBHOOK PAYLOAD]", JSON.stringify(payload, null, 2));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Cache refreshed via webhook",
        timestamp: new Date().toISOString(),
        payload: payload ? "received" : "none",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[WEBHOOK REFRESH ERROR]", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Failed to process webhook",
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

// GET not allowed for webhooks
export const GET: APIRoute = async () => {
  return new Response("Webhook endpoint - POST only", {
    status: 405,
    headers: { Allow: "POST" },
  });
};
