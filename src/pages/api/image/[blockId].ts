import type { APIRoute } from "astro";
import { Client } from "@notionhq/client";
import { withRateLimit, RATE_LIMITS } from "@/utils/apiSecurity";

const NOTION_KEY = import.meta.env.NOTION_KEY;

if (!NOTION_KEY) {
  throw new Error("Missing NOTION_KEY environment variable");
}

const notion = new Client({
  auth: NOTION_KEY,
});

// Cache for image URLs (blockId -> {url, timestamp})
const imageUrlCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_DURATION = 50 * 60 * 1000; // 50 minutes (less than Notion's 1 hour)

function getCachedImageUrl(blockId: string): string | null {
  const cached = imageUrlCache.get(blockId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.url;
  }
  if (cached) {
    imageUrlCache.delete(blockId); // Remove expired
  }
  return null;
}

function setCachedImageUrl(blockId: string, url: string): void {
  imageUrlCache.set(blockId, { url, timestamp: Date.now() });
}

export const GET: APIRoute = withRateLimit(async ({ params }) => {
  const blockId = params.blockId;

  if (!blockId) {
    return new Response("Block ID is required", { status: 400 });
  }

  try {
    // Check cache first
    const cachedUrl = getCachedImageUrl(blockId);
    if (cachedUrl) {
      return Response.redirect(cachedUrl, 302);
    }

    // Fetch fresh URL from Notion
    const block = await notion.blocks.retrieve({
      block_id: blockId,
    });

    if (block.type !== "image") {
      return new Response("Block is not an image", { status: 400 });
    }

    const imageBlock = block as any;
    const imageUrl =
      imageBlock.image?.file?.url || imageBlock.image?.external?.url;

    if (!imageUrl) {
      return new Response("Image URL not found", { status: 404 });
    }

    // Cache the URL
    setCachedImageUrl(blockId, imageUrl);

    // Redirect to the image
    return Response.redirect(imageUrl, 302);
  } catch (error) {
    console.error("Error fetching image from Notion:", error);
    return new Response("Failed to fetch image", { status: 500 });
  }
}, RATE_LIMITS.MODERATE); // Moderate rate limiting for image requests
