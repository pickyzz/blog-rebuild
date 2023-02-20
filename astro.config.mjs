import { defineConfig } from "astro/config";
import compress from 'astro-compress';
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import robotsTxt from "astro-robots-txt";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  site: "https://pickyzz.dev/",
  integrations: [
    compress({
      css: true,
			html: true,
			img: false,
			js: true,
			svg: false,
    }),
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
    robotsTxt(),
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
    shikiConfig: {
      theme: "nord",
      wrap: true,
    },
    extendDefaultPlugins: true,
  },
});
