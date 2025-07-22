import { Client } from "@notionhq/client";
import fs from "fs";
import { config } from "dotenv";
import { parseArgs } from "node:util";
import { delay } from "../helpers/delay.mjs";

const ARGUMENT_OPTIONS = { published: { type: "boolean", short: "p" } };
const { values: { published } } = parseArgs({ options: ARGUMENT_OPTIONS });
const isPublished = !!published;

config();
if (!process.env.NOTION_KEY || !process.env.DATABASE_ID)
  throw new Error("Missing Notion .env data");
const NOTION_KEY = process.env.NOTION_KEY;
const DATABASE_ID = process.env.DATABASE_ID;
const THROTTLE_DURATION = 334;
const LOG_FILE = "./logs.txt";

const notion = new Client({ auth: NOTION_KEY, config: { parseChildPages: false } });

async function main() {
  try {
    const queryParams = { database_id: DATABASE_ID };
    if (isPublished) {
      queryParams.filter = {
        and: [{ property: "status", select: { equals: "published" } }],
      };
    }
    const databaseResponse = await notion.databases.query(queryParams);
    const { results } = databaseResponse;

    // use pattern: {title} - {last_edited_time} และ sort ด้วย last_edited_time, title (ASC)
    const logs = results
      .map(page => {
        const { properties, last_edited_time } = page;
        const title = properties.title.title[0].plain_text;
        return { title, last_edited_time };
      })
      .sort((a, b) => {
        // sort ASC: last_edited_time, title
        if (a.last_edited_time === b.last_edited_time) {
          return a.title.localeCompare(b.title);
        }
        return (a.last_edited_time || '').localeCompare(b.last_edited_time || '');
      })
      .map(item => `${item.title} - ${item.last_edited_time}`)
      .join("\n") + "\n";

    let shouldWrite = true;
    if (fs.existsSync(LOG_FILE)) {
      const oldLogs = fs.readFileSync(LOG_FILE, "utf8");
      if (oldLogs === logs) {
        console.log("No change in logs. Skip writing.");
        shouldWrite = false;
      }
    }
    if (shouldWrite) {
      fs.writeFileSync(LOG_FILE, logs);
      console.log("Logs updated.");
    }

    for (let page of results) {
      await delay(THROTTLE_DURATION);
    }
    console.info("Watcher logs sync complete.");
  } catch (err) {
    console.error("Watcher logs sync failed:", err);
    process.exit(1);
  }
}

main();
