import type { BlogPost } from "@/types";
import postOgImage from "@/utils/og-templates/post";
import siteOgImage from "@/utils/og-templates/site";

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
  return svgBufferToImageBuffer(svg, format);
}

export async function generateOgImageForSite(format: "png" | "webp" = "png") {
  const svg = await siteOgImage();
  return svgBufferToImageBuffer(svg, format);
}
