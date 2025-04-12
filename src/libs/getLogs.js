import { Client } from "@notionhq/client";
import fs from "fs";
import { config } from "dotenv";
import { parseArgs } from "node:util";
import { delay } from "../helpers/delay.mjs";

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
const pages = results.map((page) => {
  const { properties, last_edited_time } = page;
  const title = properties.title.title[0].plain_text;

  console.info("Notion Page:", page);

  return {
    title,
    last_edited_time,
  };
});

fs.unlinkSync("./logs.txt"); // delete old logs file

for (let page of pages) {
  const timestamp = `${page.title} - ${page.last_edited_time}`;
  fs.appendFile(`${process.cwd()}/logs.txt`, timestamp + "\n", function (err) {
    if (err) throw err;
    console.log("Log Saved!");
  }); // write new logs file

  console.debug(`Sleeping for ${THROTTLE_DURATION} ms...\n`);
  await delay(THROTTLE_DURATION); // Need to throttle requests to avoid rate limiting
}

console.info("Successfully synced posts with Notion");
