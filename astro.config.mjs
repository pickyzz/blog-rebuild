import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import { SITE } from "./src/config";
import { remarkReadingTime } from "./src/utils/remark-reading-time.mjs";
import mdx from "@astrojs/mdx";
import rehypeExternalLinks from "rehype-external-links";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: SITE.website,
  output: "static",
  vite: {
    // Externalize resvg native package to avoid bundling .node files with esbuild
    ssr: {
      external: ["@resvg/resvg-js"],
    },
    // Prevent Vite optimizeDeps from pre-bundling native package during dev
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
  },
  trailingSlash: "never",
    // service: passthroughImageService(),
  compressHTML: true,
  build: {
    inlineStylesheets: "auto",
  },
  integrations: [
    tailwind(),
    sitemap({
      filter: page => SITE.showArchives || !page.endsWith("/archives"),
      serialize(item) {
        // Set priority and changefreq based on page type
        if (item.url === SITE.website || item.url === `${SITE.website}/`) {
          // Homepage
          item.priority = 1.0;
          item.changefreq = "daily";
        } else if (item.url.includes("/blog/")) {
          // Blog pages
          item.priority = 0.8;
          item.changefreq = "weekly";
        } else if (item.url.includes("/tags/")) {
          // Tag pages
          item.priority = 0.6;
          item.changefreq = "monthly";
        } else if (
          item.url.includes("/about") ||
          item.url.includes("/archives")
        ) {
          // About and archives pages
          item.priority = 0.5;
          item.changefreq = "yearly";
        } else {
          // Other pages
          item.priority = 0.7;
          item.changefreq = "monthly";
        }
        return item;
      },
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
      theme: "dark-plus",
      wrap: true,
    },
    extendDefaultPlugins: true,
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport",
  },
});
