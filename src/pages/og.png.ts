import type { APIRoute } from "astro";
import { generateOgImageForSite } from "@/utils/generateOgImages";

/**
 * Generates the default OpenGraph image for the website.
 *
 * @returns A PNG image for the website OpenGraph image.
 */
export const GET: APIRoute = async () =>
  new Response(await generateOgImageForSite(), {
    headers: { "Content-Type": "image/png" },
  });
