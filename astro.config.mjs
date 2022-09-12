import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from "@astrojs/react";
import robotsTxt from 'astro-robots-txt';
import tailwind from "@astrojs/tailwind";

import compress from "astro-compress";
import { astroImageTools } from "astro-imagetools";

// https://astro.build/config
export default defineConfig({
  site: 'https://pickyzz.dev',
  // Important!
  // Only official '@astrojs/*' integrations are currently supported by Astro.
  // Add 'experimental.integrations: true' to make 'astro-robots-txt' working
  // with 'astro build' command.
  experimental: {
    integrations: true
  },
  markdown: {
    shikiConfig: {
      // Choose from Shiki's built-in themes (or add your own)
      // https://github.com/shikijs/shiki/blob/main/docs/themes.md
      theme: 'github-dark-dimmed'
    }
  },
  integrations: [
    mdx(),
    sitemap(),
    react(),
    tailwind(),
    astroImageTools,
    robotsTxt(), 
    compress({
      css: true,
      html: true,
      js: true,
      img: true,
      svg: true,
    })
  ]
});