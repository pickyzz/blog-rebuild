# Pickyzz Blog Rebuild

A modern blog powered by Astro and Notion as a Content Management System, featuring beautiful design and seamless content management.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Requirements](#requirements)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Working with Notion as CMS](#working-with-notion-as-cms)
- [Development](#development)
- [Build and Deployment](#build-and-deployment)
- [Available Commands](#available-commands)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

## Overview

This blog is powered by **Astro & Notion**, providing a seamless writing and publishing experience. Version 2.1.0 is based on the [Astro-paper](https://github.com/satnaing/astro-paper) theme and uses the Notion API as a Content Management System based on [AstroNot](https://github.com/jsonMartin/AstroNot).

Customized and maintained by [Pickyzz](https://github.com/pickyzz).

## Features

- 🚀 **Fast and Modern**: Built with Astro for optimal performance
- 📝 **Notion CMS**: Use Notion as your content management system
- 🎨 **Beautiful Design**: Based on the popular Astro-paper theme
- 📱 **Responsive**: Works perfectly on all devices
- 🔍 **SEO Optimized**: Built-in SEO features and sitemap generation
- 🌙 **Dark Mode**: Light and dark theme support
- 📊 **Analytics Ready**: Easy integration with analytics tools

## Tech Stack

- **Framework**: [Astro](https://astro.build/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **CMS**: [Notion API](https://developers.notion.com/)
- **Language**: TypeScript
- **Package Manager**: npm (supports yarn, pnpm, bun)

## Requirements

- **Node.js** (version 18 or higher recommended)
- **npm** (or yarn, pnpm, bun)
- **Notion Account** with integration setup

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/pickyzz/blog-rebuild.git
cd blog-rebuild
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file and configure your Notion integration:

```bash
cp example.env .env
```

Then edit `.env` with your Notion credentials (see [Environment Variables](#environment-variables) section).

### 4. Set Up Notion Database

Duplicate [this Notion template](https://pickyzz.notion.site/b60241fb283943c29acd6bc6c91acc77?v=f688e711757a47339b30e33f1fbf8d7e&pvs=4) and **do not edit the table's name**.

### 5. Sync Content and Start Development

```bash
# Sync published posts from Notion
npm run sync:published

# Start development server
npm run dev
```

Open [http://localhost:4321](http://localhost:4321) in your browser to see your project.

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Notion Integration Token
# Get this from: https://www.notion.so/my-integrations
NOTION_KEY='secret_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'

# Notion Database ID
# Go to your notion database page in browser, click share, invite, copy link
# Remove the ID (before the v=), and paste here
DATABASE_ID='XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
```

### How to Get Your Notion Credentials:

1. **NOTION_KEY**:
   - Go to [Notion Integrations](https://www.notion.so/my-integrations)
   - Create a new integration
   - Copy the "Internal Integration Token"

2. **DATABASE_ID**:
   - Open your Notion database in browser
   - Click "Share" → "Invite" → "Copy link"
   - Extract the database ID from the URL (the part before `?v=`)

## Working with Notion as CMS

### Database Setup

1. Duplicate the [provided Notion template](https://pickyzz.notion.site/b60241fb283943c29acd6bc6c91acc77?v=f688e711757a47339b30e33f1fbf8d7e&pvs=4)
2. **Important**: Do not modify the table structure or column names
3. Share the database with your integration
4. Add your database ID to the `.env` file

### Content Sync Options

- **Development**: Use `npm run sync` to sync all posts (including drafts)
- **Published Only**: Use `npm run sync:published` to sync only published posts
- **Production Build**: Use `npm run generate` to sync published posts and build for production

## Development

### Local Development

```bash
npm run dev
```

This starts the development server at `http://localhost:4321` with hot reload.

### Available Development Commands

```bash
# Lint code
npm run lint

# Format code
npm run format

# Check types
npm run astro check
```

## Build and Deployment

### Production Build

```bash
npm run build
```

### Full Generation (Recommended for Production)

```bash
npm run generate
```

This command:

1. Syncs published posts from Notion
2. Builds the static site
3. Generates search index
4. Prepares everything for deployment

### Deployment

The generated files are located in the `dist` folder. You can deploy this folder to any static hosting service like:

- Vercel
- Netlify
- GitHub Pages
- Cloudflare Pages

## Available Commands

| Command                  | Action                                                   |
| :----------------------- | :------------------------------------------------------- |
| `npm install`            | Installs dependencies                                    |
| `npm run dev`            | Starts local dev server at `localhost:4321`              |
| `npm run build`          | Build your production site to `./dist/`                  |
| `npm run preview`        | Preview your build locally, before deploying             |
| `npm run clean`          | Remove `./dist` folder                                   |
| `npm run format`         | Format code with Prettier                                |
| `npm run lint`           | Run ESLint to check code quality                         |
| `npm run sync`           | Sync all posts from Notion database                      |
| `npm run sync:published` | Sync only published posts from Notion database           |
| `npm run generate`       | Sync published posts and build static site for deploying |
| `npm run test`           | Run Playwright tests                                     |

## Project Structure

```
├── public/                 # Static assets
├── src/
│   ├── assets/            # Images and other assets
│   ├── components/        # Reusable components
│   ├── content/           # Content collections (generated from Notion)
│   ├── layouts/           # Page layouts
│   ├── libs/              # Notion integration and utilities
│   ├── pages/             # Astro pages
│   ├── scripts/           # Client-side scripts
│   ├── styles/            # Global styles
│   └── utils/             # Utility functions
├── astro.config.mjs       # Astro configuration
├── package.json           # Dependencies and scripts
├── tailwind.config.js     # Tailwind CSS configuration
└── tsconfig.json          # TypeScript configuration
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

Made with ❤️ by [Pickyzz](https://github.com/pickyzz)
