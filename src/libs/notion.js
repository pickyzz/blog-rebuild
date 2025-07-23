import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import fs from "fs";
import readingTime from "reading-time";
import { config } from "dotenv";
import { parseArgs } from "node:util";
import { sanitizeUrl, sanitizeImageString } from "../helpers/sanitize.mjs";
import { downloadImage } from "../helpers/images.mjs";

// Input Arguments
const ARGUMENT_OPTIONS = {
  published: {
    // Only sync published posts
    type: "boolean",
    short: "p",
  },
};
const {
  values: { published },
} = parseArgs({ options: ARGUMENT_OPTIONS });
const isPublished = !!published;
console.log(`Syncing Published Only: ${isPublished}`);

// Load ENV Variables
config();
if (!process.env.NOTION_KEY || !process.env.DATABASE_ID)
  throw new Error("Missing Notion .env data");
const NOTION_KEY = process.env.NOTION_KEY;
const DATABASE_ID = process.env.DATABASE_ID; // TODO: Import from ENV

const POSTS_PATH = `src/content/blog`;

const notion = new Client({
  auth: NOTION_KEY,
  config: {
    parseChildPages: false,
  },
});

// Notion Custom Block Transform START
const n2m = new NotionToMarkdown({ notionClient: notion });
n2m.setCustomTransformer("embed", async block => {
  const { embed } = block;
  if (!embed?.url) return "";
  return `<figure>
  <iframe src="${embed?.url}"></iframe>
  <figcaption>${await n2m.blockToMarkdown(embed?.caption)}</figcaption>
</figure>`;
});

n2m.setCustomTransformer("image", async block => {
  const { image } = block;
  const imageUrl = image?.file?.url || image?.external?.url;
  const imageFileName = sanitizeImageString(imageUrl.split("/").pop());
  const filePath = await downloadImage(imageUrl, `./images/${imageFileName}`);
  const fileName = filePath.split("/").pop();

  return `<Image src="@assets/images/blog/${fileName}" />`;
});

n2m.setCustomTransformer("video", async block => {
  const { video } = block;
  const {
    external: { url: videoUrl },
  } = video;

  let url = videoUrl;

  if (url.includes("youtube.com")) {
    if (url.includes("/watch")) {
      // Youtube URLs with the /watch format don't work, need to be replaced with /embed
      const videoId = url.split("&")[0].split("?v=")[1];
      url = `https://www.youtube.com/embed/${videoId}`;
    }
  }

  return `<iframe width="100%" height="480" src="${url}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
});
// Notion Custom Block Transform END

// Fetch Notion Posts from Database via Notion API
const queryParams = {
  database_id: DATABASE_ID,
};

if (isPublished) {
  queryParams.filter = {
    and: [
      {
        property: "status",
        select: {
          equals: "published",
        },
      },
    ],
  };
}

const databaseResponse = await notion.databases.query(queryParams);
const { results } = databaseResponse;

// Create Pages
const pages = results.map(page => {
  const { properties, cover, created_time, last_edited_time, archived } = page;
  const title = properties.title.title[0].plain_text;
  const slug = properties?.slug?.rich_text[0]?.plain_text || sanitizeUrl(title);

  console.info("Notion Page:", page);

  return {
    id: page.id,
    title,
    type: page.object,
    cover: cover?.external?.url || cover?.file?.url,
    tags: properties.tags.multi_select,
    created_time,
    last_edited_time,
    featured: properties?.featured?.select?.name,
    archived,
    status: properties?.status?.select?.name,
    publish_date: properties?.publish_date?.date?.start,
    modified_date: properties?.modified_date?.date?.start,
    description: properties?.description?.rich_text[0]?.plain_text,
    slug,
  };
});

const pageTasks = pages.map(async page => {
  console.info(
    "Fetching from Notion & Converting to Markdown: ",
    `${page.title}`
  );
  const mdblocks = await n2m.pageToMarkdown(page.id);
  const { parent: mdString } = n2m.toMarkdownString(mdblocks);

  const estimatedReadingTime = readingTime(mdString || "").text;

  // Download Cover Image
  const coverFileName = page.cover
    ? await downloadImage(page.cover, { isCover: true })
    : "";
  if (coverFileName) console.info("Cover image downloaded:", coverFileName);

  // Generate page contents (frontmatter, MDX imports, + converted Notion markdown)
  const pageContents = `---
title: "${page.title}"
slug: "${page.slug}"
ogImage: ${coverFileName}
featured: ${page.featured === "featured" ? true : false}
tags: ${JSON.stringify(page.tags.map(tag => tag.name))}
draft: ${page.status === "draft" ? true : false}
pubDatetime: ${page.publish_date === undefined ? page.created_time : page.publish_date}
modDatetime: ${page.modified_date === undefined ? page.publish_date : page.modified_date}
description: "${page.description === "undefined" ? "" : page.description}"
readingTime: "${estimatedReadingTime}"
---
import Image from '../../components/Image.astro';

${mdString}
`;

  if (mdString)
    fs.writeFileSync(
      `${process.cwd()}/${POSTS_PATH}/${page.slug}.mdx`,
      pageContents
    );
  else console.log(`No content for page ${page.id}`);
});

const startTime = Date.now();
await Promise.all(pageTasks);

console.info("Successfully synced posts with Notion");
const endTime = Date.now();
const duration = ((endTime - startTime) / 1000).toFixed(2);
console.info(`Sync completed in ${duration} seconds.`);
