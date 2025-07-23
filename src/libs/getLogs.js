import { Client } from "@notionhq/client";
import fs from "fs";
import { config } from "dotenv";
import { parseArgs } from "node:util";

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

// const POSTS_PATH = `src/content/blog`;
const THROTTLE_DURATION = 334; // ms Notion API has a rate limit of 3 requests per second, so ensure that is not exceeded

const notion = new Client({
  auth: NOTION_KEY,
  config: {
    parseChildPages: false,
  },
});

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
  const { properties, last_edited_time } = page;
  const title = properties.title.title[0].plain_text;
  return {
    title,
    last_edited_time,
  };
});

// Sort by last_edited_time (descending)
pages.sort((a, b) => b.last_edited_time.localeCompare(a.last_edited_time));

// Prepare new logs content
const newLogs = pages.map(page => `${page.title} - ${page.last_edited_time}`).join("\n") + "\n";

// Read old logs.txt if exists
let oldLogs = "";
const logsPath = `${process.cwd()}/logs.txt`;
if (fs.existsSync(logsPath)) {
  oldLogs = fs.readFileSync(logsPath, "utf-8");
}

if (newLogs !== oldLogs) {
  fs.writeFileSync(logsPath, newLogs, "utf-8");
  console.log("Logs updated!");
} else {
  console.log("No changes detected. Logs not updated.");
}

console.info("Successfully synced posts with Notion");
