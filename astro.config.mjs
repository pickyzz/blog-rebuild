import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import robotsTxt from 'astro-robots-txt';
import tailwind from '@astrojs/tailwind';
import compress from 'astro-compress';
import compressor from 'astro-compressor';
import partytown from '@astrojs/partytown';
import prefetch from '@astrojs/prefetch';

// https://astro.build/config
export default defineConfig({
  site: 'https://pickyzz.dev/',
  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: {
      // Choose from Shiki's built-in themes (or add your own)
      // https://github.com/shikijs/shiki/blob/main/docs/themes.md
      theme: 'nord'
    }
  },
  integrations: [
    mdx({
      extendMarkdownConfig: false,
      smartypants: true,
      gfm: true,
    }),
    sitemap(),
    react(),
    tailwind(),
    robotsTxt(),
    partytown({
      // Example: Add dataLayer.push as a forwarding-event.
      config: { 
        forward: ["dataLayer.push"] 
      },
    }),
    compress({
      css: true,
      html: true,
      js: true,
      img: false,
      svg: true
    }),
    prefetch(),
    compressor() //must in last position.
  ]
});
