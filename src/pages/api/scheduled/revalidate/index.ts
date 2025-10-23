import type { APIRoute } from "astro";
import { invalidateCache, invalidateCacheKey, CacheKeys } from "@/utils/cache/kv-cache";
import { authenticateRequest } from "@/utils/apiAuth";

//  * Scheduled Revalidation API
//  * Triggered by Vercel Cron Jobs to automatically refresh cache
//  *
//  * Cron Schedule Examples:
//  * - Every 5 minutes: */5 * * * *
//  * - Every hour: 0 * * * *
//  * - Every 6 hours: 0 */6 * * *
//  * - Daily at midnight: 0 0 * * *

export const POST: APIRoute = async ({ request }) => {
  try {
    // Authenticate the request (for security)
    const authResult = authenticateRequest(request);
    if (!authResult.success) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const startTime = Date.now();
    const results = {
      homepage: false,
      blogIndex: false,
      posts: false,
      tags: false,
      errors: [] as string[],
      duration: 0,
    };

    try {
      // Invalidate all Notion-related cache (homepage, blog, posts)
      await invalidateCache("notion:*");
      results.homepage = true;
      results.blogIndex = true;
      results.posts = true;
      console.log("[SCHEDULED] Invalidated all Notion cache");
    } catch (error) {
      results.errors.push(`Notion Cache: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    try {
      // Invalidate tags cache
      await invalidateCacheKey(CacheKeys.allTags());
      results.tags = true;
      console.log("[SCHEDULED] Invalidated tags cache");
    } catch (error) {
      results.errors.push(`Tags: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    results.duration = Date.now() - startTime;

    // Log results
    console.log(`[SCHEDULED REVALIDATION] Completed in ${results.duration}ms`, {
      success: results.errors.length === 0,
      invalidated: Object.entries(results).filter(([key, value]) => value === true).map(([key]) => key),
      errors: results.errors.length,
    });

    return new Response(
      JSON.stringify({
        success: results.errors.length === 0,
        message: "Scheduled revalidation completed",
        timestamp: new Date().toISOString(),
        results,
      }),
      {
        status: results.errors.length === 0 ? 200 : 207, // 207 Multi-Status for partial success
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[SCHEDULED REVALIDATION] Critical error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
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
      message: "Scheduled Revalidation API",
      description: "Automatically refreshes cache for better performance",
      usage: {
        method: "POST",
        authentication: "Bearer token required",
        triggers: [
          "Vercel Cron Jobs",
          "Manual webhook calls",
          "Scheduled workflows",
        ],
        schedule: {
          allCache: "Every 5 minutes (via cron)",
          homepage: "Every 60 minutes (ISR)",
          blogIndex: "Every 5 minutes (ISR)",
          posts: "Every 30 minutes (ISR)",
          tags: "Every 2 hours (ISR)",
        },
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
};

// Health check endpoint
export const ALL: APIRoute = async ({ request }) => {
  if (request.method === "HEAD") {
    return new Response(null, { status: 200 });
  }
  return new Response("Method not allowed", { status: 405 });
};
