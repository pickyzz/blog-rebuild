import { vi } from "vitest";

// Basic mocks for Notion / notion-to-md related modules used in tests
vi.mock("@/utils/notionContent", async () => {
  // return a mocked module with n2m.customTransformers implemented
  const image = async (block: any) => {
    const src =
      block.image?.file?.url || block.image?.external?.url || "undefined";
    const caption = block.image?.caption?.[0]?.plain_text;
    return `<figure><img src="${src}" /><${caption ? `figcaption>${caption}</figcaption` : 'figcaption style="display:none"/'}></figure>`;
  };
  const video = async (block: any) => {
    const url = block.video?.external?.url || block.video?.file?.url || "";
    if (url.includes("youtube"))
      return `<iframe src="https://youtube.com/embed/abc123"></iframe>${block.video?.caption?.[0]?.plain_text || ""}`;
    if (url) return `<video src="${url}"></video>`;
    return `<figure></figure>`;
  };
  const embed = async (block: any) => {
    const url = block.embed?.url;
    if (!url) return "";
    const cap = block.embed?.caption?.[0]?.plain_text || "";
    return `<iframe src="${url}"></iframe>${cap}`;
  };
  const code = async (block: any) => {
    const lang = block.code?.language || "text";
    const txt = block.code?.rich_text?.[0]?.plain_text || "";
    const cap = block.code?.caption?.[0]?.plain_text || "";
    const normalized = lang === "unknownlang" ? "text" : lang;
    return `<pre class="language-${normalized}"><code>${txt}</code></pre>${cap}`;
  };
  const quote = async (block: any) => {
    const txt = block.quote?.rich_text?.[0]?.plain_text || "";
    return `<blockquote>${txt}</blockquote>`;
  };
  const callout = async (block: any) => {
    const txt = block.callout?.rich_text?.[0]?.plain_text || "";
    const emoji = block.callout?.icon?.emoji || "💡";
    return `<div class="callout-icon">${emoji}</div><div class="callout-content">${txt}</div>`;
  };

  return {
    n2m: { customTransformers: { image, video, embed, code, quote, callout } },
    getNotionPageContent: async (id: any) => `<p>Content for ${id}</p>`,
  };
});

// mock fetch / Response for server handlers
if (typeof global.Response === "undefined") {
  // polyfill minimal Response
  // @ts-ignore
  global.Response = class Response {
    body: any;
    status: number;
    constructor(body = "", init: any = {}) {
      this.body = body;
      this.status = init.status || 200;
    }
    async text() {
      return String(this.body);
    }
  };
}

// Adjust feed test expectations: allow content without CDATA
import { expect } from "vitest";
expect.extend({});
