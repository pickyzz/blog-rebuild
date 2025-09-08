import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import cloudflare from "@astrojs/cloudflare";
import { SITE } from "./src/config";
import { remarkReadingTime } from "./src/utils/remark-reading-time.mjs";
import mdx from "@astrojs/mdx";
import rehypeExternalLinks from "rehype-external-links";
import sitemap from "@astrojs/sitemap";
import pwa from "@vite-pwa/astro";

// https://astro.build/config
export default defineConfig({
  site: SITE.website,
  output: "server",
  adapter: process.env.NODE_ENV === "production" ? cloudflare() : undefined,
  trailingSlash: "never",
  image: {
    service: {
      entrypoint: "astro/assets/services/passthrough",
    },
  },
  integrations: [
    tailwind(),
    sitemap({
      filter: page => SITE.showArchives || !page.endsWith("/archives"),
    }),
    mdx({
      extendMarkdownConfig: true,
      smartypants: true,
      gfm: true,
    }),
    pwa({
      registerType: "autoUpdate",
      manifest: false, // Use external manifest file
      workbox: {
        globPatterns: ["**/*.{css,js,html,svg,png,ico,txt,woff2}"],
        navigateFallback: "/offline",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/prod-files-secure\.s3\.us-west-2\.amazonaws\.com\/.*$/,
            handler: "CacheFirst",
            options: {
              cacheName: "notion-images",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      },
      injectManifest: {
        swSrc: "src/sw.ts"
      },
      strategies: "injectManifest"
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
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport",
  },
  experimental: {
    clientPrerender: true,
  },
  headers: {
    "/*": [
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "X-XSS-Protection",
        value: "1; mode=block",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value:
          "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
      },
      {
        key: "Content-Security-Policy",
        value:
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;",
      },
    ],
  },
});
