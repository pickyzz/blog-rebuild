import { defineConfig } from "astro/config";
import { SITE } from "./src/config";
import { remarkReadingTime } from "./src/utils/remark-reading-time.mjs";
import mdx from "@astrojs/mdx";
import prefetch from "@astrojs/prefetch";
import react from "@astrojs/react";
import rehypeExternalLinks from "rehype-external-links";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  legacy: {
    collections: true
  },
  site: SITE.website,
  trailingSlash: "never",
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    react({
      include: ["**/react/*"],
    }),
    sitemap(),
    mdx({
      extendMarkdownConfig: true,
      smartypants: true,
      gfm: true,
    }),
    prefetch(),
  ],
  markdown: {
    remarkPlugins: [
      remarkToc,
      remarkReadingTime,
      [
        remarkCollapse,
        {
          test: "Table of contents",
          summary: "Click to show/hide",
        },
      ],
    ],
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
    optimizeDeps: {
      exclude: ["@resvg/resvg-js", "fsevents"],
    },
  },
  scopedStyleStrategy: "where",
});
