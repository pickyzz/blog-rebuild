import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import fs from "fs";
import readingTime from "reading-time";
import { config } from "dotenv";
import { parseArgs } from "node:util";
import { sanitizeUrl, sanitizeImageString } from "../helpers/sanitize.mjs";
import { downloadImage } from "../helpers/images.mjs";
import { delay } from "../helpers/delay.mjs";
import crypto from "crypto";
import path from "path";

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

// Load ENV Variables
config();
if (!process.env.NOTION_KEY || !process.env.DATABASE_ID)
  throw new Error("Missing Notion .env data");
const NOTION_KEY = process.env.NOTION_KEY;
const DATABASE_ID = process.env.DATABASE_ID; // TODO: Import from ENV

const POSTS_PATH = `src/content/blog`;
const THROTTLE_DURATION = 334; // ms Notion API has a rate limit of 3 requests per second, so ensure that is not exceeded

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
  try {
    const filePath = await downloadImage(imageUrl, `./images/${imageFileName}`);
    const fileName = filePath.split("/").pop();
    return `<Image src="@assets/images/blog/${fileName}" />`;
  } catch (err) {
    logger.warn(`[Notion] Failed to download image: ${imageUrl}`, err);
    return "";
  }
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
// Custom: Callout
n2m.setCustomTransformer("callout", async block => {
  const { callout } = block;
  const icon = callout.icon?.emoji || "";
  const text = await n2m.blockToMarkdown(callout.rich_text);
  return `> ${icon} ${text}`;
});
// Custom: Code Block
n2m.setCustomTransformer("code", async block => {
  const { code } = block;
  const lang = code.language || "";
  const text = code.rich_text.map(rt => rt.plain_text).join("");
  return `\n\
${lang}\n${text}\n\n`;
});
// Custom: Table
n2m.setCustomTransformer("table", async block => {
  // Notion-to-md does not natively support table block, so fallback to default if not present
  if (!block.table) return "";
  const rows = block.table.rows || [];
  if (!rows.length) return "";
  const header = rows[0].cells.map(cell => cell[0]?.plain_text || "").join(" | ");
  const divider = rows[0].cells.map(() => "---").join(" | ");
  const body = rows.slice(1).map(row => row.cells.map(cell => cell[0]?.plain_text || "").join(" | ")).join("\n");
  return `\n${header}\n${divider}\n${body}\n`;
});
// Notion Custom Block Transform END

// --- Logger ---
const logger = {
  info: (...args) => console.info("[INFO]", ...args),
  warn: (...args) => console.warn("[WARN]", ...args),
  error: (...args) => console.error("[ERROR]", ...args),
  debug: (...args) => console.debug("[DEBUG]", ...args),
};
logger.info(`Syncing Published Only: ${isPublished}`);

// --- Log Sync Result Utility ---
import { promises as fsp } from "fs";
const LOG_FILE = "./logs.txt";

// --- Utility Functions ---
function getQueryParams(isPublished, DATABASE_ID) {
  logger.debug("[Notion] Preparing query params. Published only:", isPublished);
  const queryParams = { database_id: DATABASE_ID };
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
  return queryParams;
}

function mapNotionPageToObject(page) {
  const { properties, cover, created_time, last_edited_time, archived } = page;
  // Defensive: check for missing title
  const title = properties?.title?.title?.[0]?.plain_text || "Untitled";
  const slug = properties?.slug?.rich_text?.[0]?.plain_text || sanitizeUrl(title);
  logger.debug(`[Notion] Mapping page: ${title} (${page.id})`);
  return {
    id: page.id,
    title,
    type: page.object,
    cover: cover?.external?.url || cover?.file?.url,
    tags: (properties?.tags?.multi_select || []),
    created_time,
    last_edited_time,
    featured: properties?.featured?.select?.name,
    archived,
    status: properties?.status?.select?.name,
    publish_date: properties?.publish_date?.date?.start,
    modified_date: properties?.modified_date?.date?.start,
    description: properties?.description?.rich_text?.[0]?.plain_text,
    slug,
  };
}

async function convertPageToMarkdownAndSave(page, n2m, POSTS_PATH, downloadImage, readingTime, delay, THROTTLE_DURATION, frontmatterOptions = {}) {
  logger.info(`[Notion] Fetching & converting: ${page.title} [${page.id}]`);
  try {
    const mdblocks = await n2m.pageToMarkdown(page.id);
    const { parent: mdString } = n2m.toMarkdownString(mdblocks);
    const estimatedReadingTime = readingTime(mdString || "").text;
    // Download Cover Image
    let coverFileName = "";
    if (page.cover) {
      logger.info(`[Notion] Downloading cover image for: ${page.title}`);
      coverFileName = await downloadImage(page.cover, { isCover: true });
      if (coverFileName) logger.info("[Notion] Cover image downloaded:", coverFileName);
    }
    // Generate page contents (frontmatter, MDX imports, + converted Notion markdown)
    const pageContents = generateFrontmatter(page, coverFileName, estimatedReadingTime, frontmatterOptions) + `\nimport Image from '../../components/Image.astro';\n\n${mdString}\n`;
    const filePath = path.join(process.cwd(), POSTS_PATH, `${page.slug}.mdx`);
    let shouldWrite = true;
    if (mdString && fs.existsSync(filePath)) {
      const oldContent = fs.readFileSync(filePath, "utf8");
      const oldHash = crypto.createHash("sha256").update(oldContent).digest("hex");
      const newHash = crypto.createHash("sha256").update(pageContents).digest("hex");
      if (oldHash === newHash) {
        logger.info(`[Notion] No change detected, skip: ${filePath}`);
        shouldWrite = false;
      }
    }
    if (mdString && shouldWrite) {
      fs.writeFileSync(filePath, pageContents);
      logger.info(`[Notion] Saved file: ${filePath}`);
    } else if (!mdString) {
      logger.warn(`[Notion] No content for page ${page.id}`);
    }
    logger.debug(`[Notion] Sleeping for ${THROTTLE_DURATION} ms...\n`);
    await delay(THROTTLE_DURATION);
    return { status: shouldWrite ? "saved" : "skipped", filePath, title: page.title };
  } catch (err) {
    logger.error(`[Notion] Error processing page: ${page.title} (${page.id})`, err);
    return { status: "error", filePath: null, title: page.title, error: err };
  }
}

function generateFrontmatter(page, coverFileName, estimatedReadingTime, options = {}) {
  // Merge default and custom options
  const base = {
    title: page.title,
    slug: page.slug,
    ogImage: coverFileName,
    featured: page.featured === "featured" ? true : false,
    tags: page.tags.map(tag => tag.name),
    draft: page.status === "draft" ? true : false,
    pubDatetime: page.publish_date === undefined ? page.created_time : page.publish_date,
    modDatetime: page.modified_date === undefined ? page.publish_date : page.modified_date,
    description: page.description === "undefined" ? "" : page.description,
    readingTime: estimatedReadingTime,
    ...options,
  };
  // Build YAML frontmatter
  const yaml =
    Object.entries(base)
      .map(([k, v]) => {
        if (Array.isArray(v)) return `${k}: ${JSON.stringify(v)}`;
        if (typeof v === "string") return `${k}: "${v.replace(/"/g, '\\"')}"`;
        return `${k}: ${v}`;
      })
      .join("\n");
  return `---\n${yaml}\n---`;
}

// --- Main Logic ---
async function main() {
  let summary = { saved: 0, skipped: 0, error: 0 };
  let errorPages = [];
  let interrupted = false;
  function handleSigint() {
    logger.warn("[Notion] Interrupted by user. Exiting gracefully...");
    interrupted = true;
    process.exit(130);
  }
  process.on("SIGINT", handleSigint);
  try {
    logger.info("[Notion] Start syncing posts...");
    const queryParams = getQueryParams(isPublished, DATABASE_ID);
    logger.info("[Notion] Querying Notion database...");
    const databaseResponse = await notion.databases.query(queryParams);
    const { results } = databaseResponse;
    logger.info(`[Notion] Fetched ${results.length} pages from Notion.`);
    let pages = results.map(mapNotionPageToObject);
    // Sort ASC: last_edited_time, title
    pages = pages.sort((a, b) => {
      if (a.last_edited_time === b.last_edited_time) {
        return a.title.localeCompare(b.title);
      }
      return (a.last_edited_time || '').localeCompare(b.last_edited_time || '');
    });
    const frontmatterOptions = { author: process.env.AUTHOR || "" };
    const BATCH_SIZE = 3;
    for (let i = 0; i < pages.length; i += BATCH_SIZE) {
      if (interrupted) break;
      const batch = pages.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(page => convertPageToMarkdownAndSave(
          page,
          n2m,
          POSTS_PATH,
          downloadImage,
          readingTime,
          delay,
          THROTTLE_DURATION,
          frontmatterOptions
        ))
      );
      for (const r of results) {
        if (r.status === "saved") summary.saved++;
        else if (r.status === "skipped") summary.skipped++;
        else if (r.status === "error") { summary.error++; errorPages.push(r.title); }
      }
      if (i + BATCH_SIZE < pages.length) {
        logger.debug(`[Notion] Batch processed. Waiting 1 second before next batch...`);
        await delay(1000);
      }
    }
    // Build logs pattern: {title} - {last_edited_time}
    const logs = pages.map(page => `${page.title} - ${page.last_edited_time}`).join("\n") + "\n";
    await fsp.writeFile(LOG_FILE, logs);
    logger.info(`[Notion] Successfully synced posts with Notion. Saved: ${summary.saved}, Skipped: ${summary.skipped}, Error: ${summary.error}`);
    if (errorPages.length) logger.warn("[Notion] Pages with error:", errorPages);
  } catch (err) {
    logger.error("[Notion] Unexpected error in main process:", err);
  } finally {
    logger.info("[Notion] Sync process completed.");
  }
}

main();
