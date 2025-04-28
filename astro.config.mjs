import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { SITE } from "./src/config";
import { remarkReadingTime } from "./src/utils/remark-reading-time.mjs";
import mdx from "@astrojs/mdx";
import rehypeExternalLinks from "rehype-external-links";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: SITE.website,
  trailingSlash: "never",
  integrations: [
    sitemap({
      filter: page => SITE.showArchives || !page.endsWith("/archives"),
    }),
    mdx({
      extendMarkdownConfig: true,
      smartypants: true,
      gfm: true,
    }),
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
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport',
  },
  experimental: {
    responsiveImages: true,
    clientPrerender: true
  },
});
