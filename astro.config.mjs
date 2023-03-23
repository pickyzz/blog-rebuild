import { defineConfig } from "astro/config";
import { SITE } from "./src/config";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import rehypeExternalLinks from 'rehype-external-links'
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import robotsTxt from "astro-robots-txt";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  site: SITE.website,
  trailingSlash: "never",
  integrations: [
    tailwind({
      config: {
        applyBaseStyles: false,
      },
    }),
    react(),
    sitemap(),
    mdx({
      extendMarkdownConfig: true,
      smartypants: true,
      gfm: true,
    }),
    robotsTxt({
      policy: [
        {
          userAgent: "*",
          disallow: ["/search"],
          crawlDelay: 10,
        },
      ],
    }),
  ],
  markdown: {
    remarkPlugins: [
      remarkToc,
      [
        remarkCollapse,
        {
          test: "Table of contents",
        },
      ],
    ],
    rehypePlugins: [
      [rehypeExternalLinks, { target: "_blank", rel: ["nofollow"] }],
    ],
    shikiConfig: {
      theme: "nord",
      wrap: true,
    },
    extendDefaultPlugins: true,
  },
  vite: {
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
  },
});
