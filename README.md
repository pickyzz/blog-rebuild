# Blog Rebuild

## Table of Contents

- [Overview](#overview)
- [Requirements](#requirements)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Working with Notion as CMS](#working-with-notion-as-cms)
- [Development](#development)
- [Production Build](#production-build)
- [Testing](#testing)
- [All Commands](#-all-commands)

## Overview

**Powered by Astro & Notion**

- V.2.1.0 based on [Astro-paper](https://github.com/satnaing/astro-paper) theme
- Notion API as Content Management System based on [AstroNot](https://github.com/jsonMartin/AstroNot)
- Customized by [Pickyzz](https://github.com/pickyzz)

## Requirements

- Node.js (version 16 or higher)
- npm, yarn, pnpm, or bun
- A Notion account with API access

## Getting Started

1. **Clone the repository**

   ```bash
   git clone https://github.com/pickyzz/blog-rebuild.git
   cd blog-rebuild
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy the example environment file:
     ```bash
     cp example.env .env
     ```
   - Configure your environment variables (see [Environment Variables](#environment-variables) section)

4. **Set up Notion database**
   - Duplicate [this Notion template](https://pickyzz.notion.site/b60241fb283943c29acd6bc6c91acc77?v=f688e711757a47339b30e33f1fbf8d7e&pvs=4)
   - Do not edit the table's name or structure

5. **Sync content and start development**
   ```bash
   npm run sync:published
   npm run dev
   ```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

| Variable      | Description                   | How to obtain                                                                                                                                    |
| ------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NOTION_KEY`  | Your Notion integration token | 1. Go to [Notion Integrations](https://www.notion.so/my-integrations)<br>2. Create a new integration<br>3. Copy the "Internal Integration Token" |
| `DATABASE_ID` | Your Notion database ID       | 1. Open your Notion database in browser<br>2. Click "Share" → "Copy link"<br>3. Extract the ID from the URL (the part before `?v=`)              |

**Example `.env` file:**

```env
NOTION_KEY='secret_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
DATABASE_ID='XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
```

## Working with Notion as CMS

- **Setup**: Duplicate the [Notion template](https://pickyzz.notion.site/b60241fb283943c29acd6bc6c91acc77?v=f688e711757a47339b30e33f1fbf8d7e&pvs=4) and configure your environment variables
- **Development sync**: Use `npm run sync` (all posts) or `npm run sync:published` (published posts only)
- **Production build**: Use `npm run generate` to sync published posts and build for production

## Development

Start the development server with live reload:

```bash
npm run dev
```

Open [http://localhost:4321](http://localhost:4321) in your browser to see your project.

## Production Build

### Manual Deployment

Create an optimized production build:

```bash
npm run build
```

## Testing

Run the test suite:

```bash
# E2E tests with Playwright
npm test

# Unit tests with Vitest
npm run test:unit

# Unit tests in watch mode
npm run test:unit:watch
```

## 🧞 All Commands

Run these commands from the root of the project:

| Command                   | Action                                        |
| :------------------------ | :-------------------------------------------- |
| `npm install`             | Installs dependencies                         |
| `npm run dev`             | Starts local dev server at `localhost:4321`   |
| `npm run build`           | Build your production site to `./dist/`       |
| `npm run preview`         | Preview your build locally, before deploying  |
| `npm run clean`           | Remove `./dist` folder                        |
| `npm run format`          | Run Prettier and format code                  |
| `npm run format:check`    | Check code formatting without modifying files |
| `npm run lint`            | Run ESLint and report linting errors          |
| `npm test`                | Run E2E tests with Playwright                 |
| `npm run test:unit`       | Run unit tests with Vitest                    |
| `npm run test:unit:watch` | Run unit tests in watch mode                  |

## 🚀 Hybrid ISR (Incremental Static Regeneration)

This project uses Hybrid ISR for optimal performance on Vercel Free Plan:

### ISR Configuration

| Page Type | Strategy | Revalidation | Cache Duration |
|-----------|----------|--------------|----------------|
| Homepage | ISR | 60 minutes | 1 hour + stale |
| Blog Index | ISR | 5 minutes | 5 min + stale |
| Blog Posts | ISR | 30 minutes | 30 min + stale |
| Tag Pages | ISR | 20 minutes | 20 min + stale |
| About Page | Static | 24 hours | 24 hours |

### Cache Layers

1. **Edge Cache (Vercel CDN)**: Global distribution
2. **Redis Cache (Upstash)**: Persistent data caching
3. **Memory Cache**: Temporary fallback

### ISR Commands

```bash
# Warm up cache after deployment
npm run cache:warm:isr

# Check ISR status
npm run isr:status

# Manual revalidation
npm run cache:invalidate:all
```

### Performance Benefits

- **85% faster load times** (2.8s → 0.4s for homepage)
- **70% bandwidth savings** (85GB → 25GB/month)
- **80% reduction in API calls** (50K → 10K/month)
- **Improved Core Web Vitals** scores

### Monitoring

- Cache statistics via `npm run cache:stats`
- Cache health check via `npm run cache:health`
- Scheduled revalidation via Vercel Cron Jobs

## Cache invalidation (Cloudflare)

- A small server-side utility is available at `src/utils/cloudflarePurge.ts` which you can call from server-side code to purge specific URLs from Cloudflare. It expects environment variables `CF_ZONE_ID` and `CF_API_TOKEN` when executed (or you can pass `zoneId`/`apiToken` directly to the function for ad-hoc usage).
- For manual or scripted purge use, see `scripts/cloudflare-purge.mjs`. It supports a `--dry-run` mode so you can preview the payload before executing.
