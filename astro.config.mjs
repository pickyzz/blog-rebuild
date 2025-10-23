import { defineConfig, passthroughImageService } from "astro/config";
import tailwind from "@astrojs/tailwind";
import vercel from "@astrojs/vercel";
import node from "@astrojs/node";
import { SITE } from "./src/config";
import { remarkReadingTime } from "./src/utils/remark-reading-time.mjs";
import mdx from "@astrojs/mdx";
import rehypeExternalLinks from "rehype-external-links";
import sitemap from "@astrojs/sitemap";
import pwa from "@vite-pwa/astro";
import { loadEnv } from "vite";

// Load environment variables
const env = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");

// https://astro.build/config
export default defineConfig({
  site: SITE.website,
  output: "server",
  vite: {
    // Externalize resvg native package to avoid bundling .node files with esbuild
    ssr: {
      external: ["@resvg/resvg-js"],
    },
    // Prevent Vite optimizeDeps from pre-bundling the native package during dev
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
    // Ensure Rollup also treats the package as external for builds
    build: {
      rollupOptions: {
        external: ["@resvg/resvg-js"],
      },
      // Optimize CSS and JS bundles
      cssMinify: true,
      minify: "esbuild",
      sourcemap: false,
      // Enhanced chunk splitting for ISR caching
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["astro", "astro/components"],
            ui: ["@astrojs/tailwind", "tailwindcss"],
            utils: ["@notionhq/client", "notion-to-md"],
            cache: ["@upstash/redis"],
          },
        },
      },
      target: "esnext", // Better performance for edge runtime
    },
    // Optimize CSS processing
    css: {
      devSourcemap: false,
    },
  },
  adapter:
    env.NODE_ENV !== "production"
      ? node({ mode: "standalone" })
      : vercel({
          edge: true, // Keep edge for better performance
          maxDuration: 30, // Increased for cache operations
        }),
  trailingSlash: "never",
  image: {
    service: passthroughImageService(),
  },
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
    pwa({
      registerType: "autoUpdate",
      manifest: false, // Use external manifest file
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ request }) =>
              request.destination === "style" ||
              request.destination === "script" ||
              request.destination === "image" ||
              request.destination === "font",
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "document",
            handler: "NetworkFirst",
            options: {
              cacheName: "pages",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: ({ url }) =>
              url.origin ===
              "https://prod-files-secure.s3.us-west-2.amazonaws.com",
            handler: "CacheFirst",
            options: {
              cacheName: "notion-images",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === "https://fonts.googleapis.com" ||
              url.origin === "https://fonts.gstatic.com",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
        // Optimize service worker
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  markdown: {
    remarkPlugins: [remarkReadingTime],
    rehypePlugins: [
      [rehypeExternalLinks, { target: "_blank", rel: ["nofollow"] }],
    ],
    shikiConfig: {
      // theme: "catppuccin-macchiato",
      themes: { light: "github-light", dark: "dark-plus" },
      wrap: true,
    },
    extendDefaultPlugins: true,
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "viewport",
  },
  output: "server",
  build: {
    inlineStylesheets: "auto",
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
      // Performance headers
      {
        key: "X-DNS-Prefetch-Control",
        value: "on",
      },
    ],
  },
});
