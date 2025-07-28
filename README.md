# Blog Rebuild

## Table of Contents

- [Overview](#overview)
- [Requirements](#requirements)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Working with Notion as CMS](#working-with-notion-as-cms)
- [Development](#development)
- [Production Build](#production-build)
- [All Commands](#-all-commands)

## Overview

**Powered by Astro & Notion**

- V.2.0.0 based on [Astro-paper](https://github.com/satnaing/astro-paper) theme
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

Or sync content and build in one command:

```bash
npm run generate
```

The generated files will be in the `dist` folder, ready for deployment to any hosting service.

## 🧞 All Commands

Run these commands from the root of the project:

| Command                  | Action                                                    |
| :----------------------- | :-------------------------------------------------------- |
| `npm install`            | Installs dependencies                                     |
| `npm run dev`            | Starts local dev server at `localhost:4321`               |
| `npm run build`          | Build your production site to `./dist/`                   |
| `npm run preview`        | Preview your build locally, before deploying              |
| `npm run clean`          | Remove `./dist` folder                                    |
| `npm run format`         | Run Prettier and format code                              |
| `npm run lint`           | Run ESLint and report linting errors                      |
| `npm run sync`           | Sync all posts from Notion database                       |
| `npm run sync:published` | Sync only published posts from Notion database            |
| `npm run generate`       | Sync published posts and build static site for deployment |
