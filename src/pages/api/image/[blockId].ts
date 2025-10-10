import type { APIRoute } from "astro";
import { Client } from "@notionhq/client";
import { throttleNotion } from "@/utils/notionRateLimiter";
import { withRateLimit, RATE_LIMITS } from "@/utils/apiSecurity";

const NOTION_KEY = import.meta.env.NOTION_KEY;
const IMAGE_MAX_BYTES = parseInt(process.env.IMAGE_MAX_BYTES || "5242880"); // 5MB default
const EDGE_MAX_AGE = parseInt(process.env.IMAGE_EDGE_S_MAXAGE || String(24 * 60 * 60)); // s-maxage seconds (default 1 day)

if (!NOTION_KEY) {
  throw new Error("Missing NOTION_KEY environment variable");
}

const notion = new Client({ auth: NOTION_KEY });

// Simple allowlist - tweak if you have other hosts you trust
const ALLOWED_HOSTS = [
  "s3.amazonaws.com",
  "prod-files-secure.s3.us-west-2.amazonaws.com",
  "images.unsplash.com",
  "images.unsplash.com",
  "pbs.twimg.com",
];

function isAllowedUrl(u: string) {
  try {
    const url = new URL(u);
    if (url.protocol !== "https:") return false;
    return ALLOWED_HOSTS.some(h => url.hostname.endsWith(h) || url.hostname.includes(h));
  } catch (e) {
    return false;
  }
}

// Create a ReadableStream wrapper that enforces a max byte limit
async function proxyStreamWithLimit(upstream: Response): Promise<ReadableStream<Uint8Array>> {
  const reader = upstream.body!.getReader();
  let received = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        if (value) {
          received += value.byteLength;
          if (IMAGE_MAX_BYTES && received > IMAGE_MAX_BYTES) {
            // cancel upstream and error
            try {
              await reader.cancel();
            } catch (_) {}
            controller.error(new Error("Image too large"));
            return;
          }
          controller.enqueue(value);
        }
      } catch (err) {
        controller.error(err);
      }
    },
    cancel(reason) {
      try {
        reader.cancel();
      } catch (_) {}
    },
  });
}

export const GET: APIRoute = withRateLimit(async ({ params }) => {
  const blockId = params.blockId;
  if (!blockId) return new Response("blockId required", { status: 400 });

  try {
  // get Notion block to obtain image URL
  await throttleNotion();
  const block = await notion.blocks.retrieve({ block_id: blockId });
  const blockAny: any = block;
  if (blockAny.type !== "image") return new Response("block is not image", { status: 400 });
  const imageUrl = blockAny.image?.file?.url || blockAny.image?.external?.url;
    if (!imageUrl || !isAllowedUrl(imageUrl)) return new Response("image URL not allowed or missing", { status: 404 });

    // fetch upstream image (if 403 try refresh signed url once)
    let upstream = await fetch(imageUrl);
    if (upstream.status === 403) {
      await throttleNotion();
      const block2 = await notion.blocks.retrieve({ block_id: blockId });
      const block2Any: any = block2;
      const imageUrl2 = block2Any.image?.file?.url || block2Any.image?.external?.url;
      if (imageUrl2 && imageUrl2 !== imageUrl) {
        upstream = await fetch(imageUrl2);
      }
    }

    if (!upstream.ok) return new Response("failed to fetch upstream image", { status: 502 });

    // size guard using Content-Length if present
    const upstreamLength = upstream.headers.get("content-length");
    if (upstreamLength && Number(upstreamLength) > IMAGE_MAX_BYTES) {
      return new Response("image too large", { status: 413 });
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    if (upstreamLength) headers.set("Content-Length", upstreamLength);
    headers.set("Cache-Control", `public, max-age=3600, s-maxage=${EDGE_MAX_AGE}, stale-while-revalidate=86400`);
    const etag = upstream.headers.get("etag");
    if (etag) headers.set("ETag", etag);

    // stream body with limit enforcement
    const body = await proxyStreamWithLimit(upstream);
    return new Response(body, { status: 200, headers });
  } catch (err: any) {
    console.error("image proxy error", err);
    if (err.message && err.message.includes("Image too large")) {
      return new Response("image too large", { status: 413 });
    }
    return new Response("internal error", { status: 500 });
  }
}, RATE_LIMITS.MODERATE);
