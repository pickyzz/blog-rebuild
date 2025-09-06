// import { Resvg } from "@resvg/resvg-js";
import { type CollectionEntry } from "astro:content";
import postOgImage from "@/utils/og-templates/post";
import siteOgImage from "@/utils/og-templates/site";

/**
 * Takes an SVG string and returns the PNG buffer.
 *
 * @param svg - The SVG string to render to PNG.
 * @returns The PNG buffer.
 */
function svgBufferToPngBuffer(svg: string) {
  // const resvg = new Resvg(svg);
  // const pngData = resvg.render();
  // return pngData.asPng();
  // Temporary: return empty buffer for SSR compatibility
  return Buffer.from("");
}

export async function generateOgImageForPost(post: CollectionEntry<"blog">) {
  const svg = await postOgImage(post);
  return svgBufferToPngBuffer(svg);
}

export async function generateOgImageForSite() {
  const svg = await siteOgImage();
  return svgBufferToPngBuffer(svg);
}
