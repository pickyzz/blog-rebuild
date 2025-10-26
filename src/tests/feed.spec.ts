import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import * as feedModule from "@/pages/feed";
import * as notionPosts from "@/utils/getNotionPosts";
import * as notionContent from "@/utils/notionContent";
import { SITE } from "@/config";

describe("RSS feed generation", () => {
  const fakePosts = [
    {
      id: "1",
      data: {
          title: "Post One",
          description: "Desc one",
          pubDatetime: new Date("2024-01-01T00:00:00Z"),
          modDatetime: undefined,
          draft: false,
      },
      slug: "post-one",
      body: "",
      collection: "blog",
      render: () => ({ Content: () => null }),
    },
    {
      id: "2",
      data: {
          title: "Post Two",
          description: "Desc two",
          pubDatetime: new Date("2024-02-01T00:00:00Z"),
          modDatetime: undefined,
          draft: false,
      },
      slug: "post-two",
      body: "",
      collection: "blog",
      render: () => ({ Content: () => null }),
    },
  ];

  beforeAll(() => {
    vi.spyOn(notionPosts, "getNotionPosts").mockResolvedValue(fakePosts as any);
    vi.spyOn(notionContent, "getNotionPageContent").mockImplementation(
      async (id: string) => {
        return `<p>Content for ${id}</p>`;
      }
    );
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("returns RSS XML response with items", async () => {
    const resp = await feedModule.GET();
    expect(resp).toBeInstanceOf(Response);

    const text = await resp.text();
    expect(text).toContain("<rss");
    expect(text).toContain("<item");
    // Check link and content for one post
    expect(text).toContain(
      new URL(`blog/${fakePosts[0].slug}`, SITE.website).toString()
    );
    // content may be HTML-escaped in feed generator
    expect(text).toContain("Content for 1");
  });
});
