import type { APIRoute } from "astro";
import { generateOgImageForSite } from "@/utils/generateOgImages";

/**
 * Generates the default OpenGraph image for the website.
 *
 * @returns A PNG image for the website OpenGraph image.
 */
export const GET: APIRoute = async () => {
  const buffer = await generateOgImageForSite();
  return new Response(new Uint8Array(buffer), {
    headers: { "Content-Type": "image/png" },
  });
};
