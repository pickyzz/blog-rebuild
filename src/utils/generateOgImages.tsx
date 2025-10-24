import type { BlogPost } from "@/types";
import postOgImage from "@/utils/og-templates/post";
import siteOgImage from "@/utils/og-templates/site";
import { SITE } from '@/config';
import crypto from 'crypto';
import { addPurgeUrl } from '@/utils/purgeList';

/**
 * Takes an SVG string and returns the PNG or WebP buffer.
 *
 * @param svg - The SVG string to render to PNG/WebP.
 * @param format - Output format: "png" | "webp"
 * @returns The image buffer.
 */
async function svgBufferToImageBuffer(
  svg: string,
  format: "png" | "webp" = "png"
) {
  // Dynamic import to avoid bundling native .node files by esbuild
  const { Resvg } = await import("@resvg/resvg-js");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
    background: "#fefbfb",
  });
  const imgData = resvg.render();
  // asWebp may not exist on all backends — cast to any for optional support
  if (format === "webp" && typeof (imgData as any).asWebp === "function") {
    return (imgData as any).asWebp({ quality: 90 }); // webp output, if supported
  }
  return imgData.asPng();
}

export async function generateOgImageForPost(
  post: BlogPost,
  format: "png" | "webp" = "png"
) {
  const svg = await postOgImage(post);
  const buffer = await svgBufferToImageBuffer(svg, format);
  // Compare generated OG with deployed URL; add to purge list only if different
  try {
    const ogPath = new URL(`/blog/${post.slug}/index.png`, SITE.website).href;
  const localBytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer as any);
  const localHash = crypto.createHash('sha256').update(localBytes).digest('hex');
    let remoteHash = null;
    try {
      const res = await fetch(ogPath);
      if (res.ok && res.body) {
        const arr = await res.arrayBuffer();
  const remoteBytes = arr instanceof Uint8Array ? arr : new Uint8Array(arr as any);
  remoteHash = crypto.createHash('sha256').update(remoteBytes).digest('hex');
      }
    } catch (e) {
      // treat fetch failure as different so purge will run
      remoteHash = null;
    }
    const differs = !remoteHash || remoteHash !== localHash;
    if (differs) {
      // Add to build-time purge list (used by manual purging)
      addPurgeUrl(ogPath);
      console.info('[OG PURGE] added to purge list:', ogPath);
    } else {
      console.info('[OG PURGE] no change detected for', ogPath);
    }
  } catch (e) {
    console.warn('[OG PURGE] compare check failed', String(e));
  }
  return buffer;
}

export async function generateOgImageForSite(format: "png" | "webp" = "png") {
  const svg = await siteOgImage();
  const buffer = await svgBufferToImageBuffer(svg, format);
  // Compare generated site OG with deployed /og.png; purge only if different
  try {
    const ogPath = new URL('/og.png', SITE.website).href;
  const localBytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer as any);
  const localHash = crypto.createHash('sha256').update(localBytes).digest('hex');
    let remoteHash = null;
    try {
      const res = await fetch(ogPath);
      if (res.ok && res.body) {
        const arr = await res.arrayBuffer();
  const remoteBytes = arr instanceof Uint8Array ? arr : new Uint8Array(arr as any);
  remoteHash = crypto.createHash('sha256').update(remoteBytes).digest('hex');
      }
    } catch (e) {
      remoteHash = null;
    }
    const differs = !remoteHash || remoteHash !== localHash;
    if (differs) {
      addPurgeUrl(ogPath);
      console.info('[OG PURGE] added to purge list:', ogPath);
    } else {
      console.info('[OG PURGE] no change detected for', ogPath);
    }
  } catch (e) {
    console.warn('[OG PURGE] compare check failed', String(e));
  }
  return buffer;
}
