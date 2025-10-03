import assert from "assert";
import formatSearchResult from "../src/pages/api/search.formatters.js";

function run() {
  // Case 1: pubDatetime is a Date
  const resultWithDate = {
    post: {
      id: "1",
      slug: "post-1",
      data: {
        title: "Post 1",
        description: "Desc",
        pubDatetime: new Date("2024-01-01T00:00:00Z"),
        tags: ["tag1"],
      },
    },
    score: 1,
    matches: [],
  };

  const formatted1 = formatSearchResult(resultWithDate);
  assert.strictEqual(formatted1.pubDatetime, new Date("2024-01-01T00:00:00Z").toISOString());

  // Case 2: pubDatetime is missing
  const resultWithoutDate = {
    post: {
      id: "2",
      slug: "post-2",
      data: {
        title: "Post 2",
        description: "Desc 2",
        // no pubDatetime
        tags: [],
      },
    },
    score: 0.5,
    matches: [],
  };

  const formatted2 = formatSearchResult(resultWithoutDate);
  assert.strictEqual(formatted2.pubDatetime, null);

  console.log("All search.formatters tests passed");
}

try {
  run();
  process.exit(0);
} catch (err) {
  console.error(err);
  process.exit(1);
}
