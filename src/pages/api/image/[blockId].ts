import type { APIRoute } from "astro";
import { Client } from "@notionhq/client";
import { throttleNotion, notionRetryWrapper } from "@/utils/notionRateLimiter";
import { withRateLimit, RATE_LIMITS } from "@/utils/apiSecurity";
import { handleProxyUrl } from "@/utils/imageProxyCommon";
import { optimizeImageUrl } from "@/config";

const NOTION_KEY = import.meta.env.NOTION_KEY;

if (!NOTION_KEY) {
  throw new Error("Missing NOTION_KEY environment variable");
}

const notion = new Client({ auth: NOTION_KEY });

export const GET: APIRoute = withRateLimit(async ({ params }) => {
  const blockId = params.blockId;
  if (!blockId) {
    console.warn(`[IMAGE BLOCK] Missing blockId parameter`);
    return new Response("blockId required", { status: 400 });
  }

  try {
    // Use retry wrapper for Notion API calls
    const block = await notionRetryWrapper(
      () => notion.blocks.retrieve({ block_id: blockId }),
      `Block retrieve ${blockId}`
    );

    const blockAny: any = block;

    if (blockAny.type !== "image") {
      console.warn(`[IMAGE BLOCK] Block ${blockId} is not an image type: ${blockAny.type}`);
      return new Response("block is not image", { status: 400 });
    }

    // Get image URL from either file or external
    let imageUrl = blockAny.image?.file?.url || blockAny.image?.external?.url;

    if (!imageUrl) {
      console.warn(`[IMAGE BLOCK] No image URL found for block ${blockId}`);
      return new Response("image URL not found", { status: 404 });
    }

    console.log(`[IMAGE BLOCK] Retrieved image URL for block ${blockId}: ${imageUrl.substring(0, 100)}...`);

    // Optimize URLs for Free Plan before proxying
    const optimizedUrl = optimizeImageUrl(imageUrl);
    if (optimizedUrl !== imageUrl) {
      console.log(`[IMAGE BLOCK] Optimized Unsplash URL for block ${blockId}`);
    }

    // Use shared proxy handler for consistency and Free Plan optimizations
    return await handleProxyUrl(optimizedUrl);

  } catch (err: any) {
    console.error(`[IMAGE BLOCK] Error processing block ${blockId}:`, {
      message: err?.message,
      code: err?.code,
      status: err?.status
    });

    // Handle specific Notion errors
    if (err?.code === "object_not_found") {
      return new Response("block not found", { status: 404 });
    }

    if (err?.code === "unauthorized") {
      return new Response("unauthorized access to block", { status: 401 });
    }

    // Handle rate limiting
    if (err?.code === "rate_limited") {
      return new Response("notion rate limit exceeded", { status: 429 });
    }

    return new Response("internal error", { status: 500 });
  }
}, RATE_LIMITS.MODERATE);
