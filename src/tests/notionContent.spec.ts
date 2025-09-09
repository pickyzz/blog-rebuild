// @ts-nocheck
import { describe, it, expect } from "vitest";
// import n2m and custom transformers from notionContent.ts
import * as notionContent from "../utils/notionContent.ts";

// Helper to get transformer from n2m instance
function getTransformer(type) {
  return notionContent.n2m.customTransformers[type];
}

describe("Notion custom transformers", () => {
  describe("image", () => {
    const transformer = getTransformer("image");

    it("renders image with caption", async () => {
      const block = {
        image: {
          file: { url: "https://img.com/1.png" },
          caption: [{ plain_text: "caption1" }]
        }
      };
      const html = await transformer(block);
      expect(html).toMatchSnapshot();
      expect(html).toContain("figure");
      expect(html).toContain("caption1");
    });

    it("renders image without caption", async () => {
      const block = {
        image: {
          external: { url: "https://img.com/2.png" }
        }
      };
      const html = await transformer(block);
      expect(html).toContain('img src="https://img.com/2.png"');
      expect(html).not.toContain("<figcaption>");
    });

    it("handles invalid input gracefully", async () => {
      const html = await transformer({});
      expect(html).toContain('<img src="undefined"');
    });
  });

  describe("video", () => {
    const transformer = getTransformer("video");

    it("renders YouTube embed", async () => {
      const block = {
        video: {
          external: { url: "https://youtube.com/watch?v=abc123" },
          caption: [{ plain_text: "yt" }]
        }
      };
      const html = await transformer(block);
      expect(html).toContain("youtube.com/embed/abc123");
      expect(html).toContain("yt");
    });

    it("renders normal video", async () => {
      const block = {
        video: {
          file: { url: "https://cdn.com/vid.mp4" }
        }
      };
      const html = await transformer(block);
      expect(html).toContain("<video");
      expect(html).toContain('src="https://cdn.com/vid.mp4"');
    });

    it("handles invalid input", async () => {
      const html = await transformer({});
      expect(html).toContain("<figure");
    });
  });

  describe("embed", () => {
    const transformer = getTransformer("embed");

    it("renders embed with caption", async () => {
      const block = {
        embed: {
          url: "https://example.com",
          caption: [{ plain_text: "caption" }]
        }
      };
      const html = await transformer(block);
      expect(html).toContain("iframe");
      expect(html).toContain("caption");
    });

    it("returns empty string if url missing", async () => {
      const html = await transformer({ embed: {} });
      expect(html).toBe("");
    });
  });

  describe("code", () => {
    const transformer = getTransformer("code");

    it("renders code block with language", async () => {
      const block = {
        code: {
          language: "javascript",
          rich_text: [{ plain_text: "console.log(1);" }],
          caption: [{ plain_text: "js code" }]
        }
      };
      const html = await transformer(block);
      expect(html).toContain("language-javascript");
      expect(html).toContain("console.log");
      expect(html).toContain("js code");
    });

    it("renders code block with unknown language", async () => {
      const block = {
        code: {
          language: "unknownlang",
          rich_text: [{ plain_text: "abc" }]
        }
      };
      const html = await transformer(block);
      expect(html).toContain("language-text");
      expect(html).toContain("abc");
    });

    it("handles missing code content", async () => {
      const html = await transformer({ code: {} });
      expect(html).toContain("language-text");
    });
  });

  describe("quote", () => {
    const transformer = getTransformer("quote");

    it("renders quote block", async () => {
      const block = {
        quote: {
          rich_text: [{ plain_text: "quoted text" }]
        }
      };
      const html = await transformer(block);
      expect(html).toContain("blockquote");
      expect(html).toContain("quoted text");
    });

    it("handles missing quote content", async () => {
      const html = await transformer({ quote: {} });
      expect(html).toContain("blockquote");
    });
  });

  describe("callout", () => {
    const transformer = getTransformer("callout");

    it("renders callout with emoji", async () => {
      const block = {
        callout: {
          rich_text: [{ plain_text: "callout text" }],
          icon: { emoji: "🚀" }
        }
      };
      const html = await transformer(block);
      expect(html).toContain("callout-icon");
      expect(html).toContain("🚀");
      expect(html).toContain("callout text");
    });

    it("renders callout with default emoji", async () => {
      const block = {
        callout: {
          rich_text: [{ plain_text: "default emoji" }]
        }
      };
      const html = await transformer(block);
      expect(html).toContain("💡");
      expect(html).toContain("default emoji");
    });

    it("handles missing callout content", async () => {
      const html = await transformer({ callout: {} });
      expect(html).toContain("callout-content");
    });
  });
});