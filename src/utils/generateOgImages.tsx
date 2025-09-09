// ปรับปรุงให้รองรับการสร้าง OG image ที่ optimized และ next-gen format
import { Resvg } from "@resvg/resvg-js";
import { type CollectionEntry } from "astro:content";
import postOgImage from "@/utils/og-templates/post";
import siteOgImage from "@/utils/og-templates/site";

/**
 * Takes an SVG string and returns the PNG or WebP buffer.
 *
 * @param svg - The SVG string to render to PNG/WebP.
 * @param format - Output format: "png" | "webp"
 * @returns The image buffer.
 */
function svgBufferToImageBuffer(svg: string, format: "png" | "webp" = "png") {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
    background: "#fefbfb"
  });
  const imgData = resvg.render();
  if (format === "webp" && typeof imgData.asWebp === "function") {
    return imgData.asWebp({ quality: 90 }); // webp output, if supported
  }
  return imgData.asPng();
}

export async function generateOgImageForPost(post: CollectionEntry<"blog">, format: "png" | "webp" = "png") {
  const svg = await postOgImage(post);
  return svgBufferToImageBuffer(svg, format);
}

export async function generateOgImageForSite(format: "png" | "webp" = "png") {
  const svg = await siteOgImage();
  return svgBufferToImageBuffer(svg, format);
}