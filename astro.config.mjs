import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { SITE } from "./src/config";
import { remarkReadingTime } from "./src/utils/remark-reading-time.mjs";
import mdx from "@astrojs/mdx";
import prefetch from "@astrojs/prefetch";
import react from "@astrojs/react";
import rehypeExternalLinks from "rehype-external-links";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  site: SITE.website,
  trailingSlash: "never",
  integrations: [
    react({
      include: ["**/react/*"],
    }),
    sitemap({
      filter: page => SITE.showArchives || !page.endsWith("/archives"),
    }),
    mdx({
      extendMarkdownConfig: true,
      smartypants: true,
      gfm: true,
    }),
    prefetch(),
  ],
  markdown: {
    remarkPlugins: [remarkReadingTime],
    rehypePlugins: [
      [rehypeExternalLinks, { target: "_blank", rel: ["nofollow"] }],
    ],
    shikiConfig: {
      // theme: "catppuccin-macchiato",
      themes: { light: "catppuccin-latte", dark: "dark-plus" },
      wrap: true,
    },
    extendDefaultPlugins: true,
  },
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["@resvg/resvg-js", "fsevents"],
    },
  },
  experimental: {
    svg: true,
  },
});
