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

4. **Sync posts from Notion** (SSG Workflow)

   ```bash
   npm run sync:posts
   ```

   This will fetch all published posts from your Notion database and convert them to static markdown files in `src/content/blog/`.

5. **Set up Notion database**
   - Duplicate [this Notion template](https://pickyzz.notion.site/b60241fb283943c29acd6bc6c91acc77?v=f688e711757a47339b30e33f1fbf8d7e&pvs=4)
   - Do not edit the table's name or structure

6. **Sync content and start development**
   ```bash
   npm run sync:posts
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
- **Development sync**: Use `npm run sync:posts` to fetch all published posts from Notion to static files
- **Production build**: Use `npm run build` to sync posts and build the static site

## Development

Start the development server with live reload:

```bash
# First sync posts from Notion
npm run sync:posts

# Then start development server
npm run dev
```

Open [http://localhost:4321](http://localhost:4321) in your browser to see your project.

**Note**: When you make changes to posts in Notion, run `npm run sync:posts` again to update the local content.

## Production Build

### Manual Deployment

Create an optimized production build:

```bash
# This command will sync posts from Notion and build the static site
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

| Command                   | Action                                            |
| :------------------------ | :------------------------------------------------ |
| `npm install`             | Installs dependencies                             |
| `npm run dev`             | Starts local dev server at `localhost:4321`       |
| `npm run sync:posts`      | Sync posts from Notion to local content files     |
| `npm run sync:posts:dev`  | Sync posts using development environment          |
| `npm run build`           | Sync posts and build production site to `./dist/` |
| `npm run rebuild`         | Clean, sync posts, and build from scratch         |
| `npm run preview`         | Preview your build locally, before deploying      |
| `npm run clean`           | Remove `./dist` folder                            |
| `npm run format`          | Run Prettier and format code                      |
| `npm run format:check`    | Check code formatting without modifying files     |
| `npm run lint`            | Run ESLint and report linting errors              |
| `npm test`                | Run E2E tests with Playwright                     |
| `npm run test:unit`       | Run unit tests with Vitest                        |
| `npm run test:unit:watch` | Run unit tests in watch mode                      |

## Cache invalidation (Cloudflare)

- A small server-side utility is available at `src/utils/cloudflarePurge.ts` which you can call from server-side code to purge specific URLs from Cloudflare. It expects environment variables `CF_ZONE_ID` and `CF_API_TOKEN` when executed (or you can pass `zoneId`/`apiToken` directly to the function for ad-hoc usage).
- For manual or scripted purge use, see `scripts/cloudflare-purge.mjs`. It supports a `--dry-run` mode so you can preview the payload before executing.
