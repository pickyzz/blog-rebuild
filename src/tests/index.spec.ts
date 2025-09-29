import { test, expect } from "@playwright/test";

test("index page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Pickyzz/);
  await expect(page).toHaveURL("/");
  await expect(page.locator("#nav-menu")).toBeVisible();
  await expect(page.locator("#main-content")).toBeVisible();
  await expect(page.locator("#featured")).toBeVisible();
  await expect(page.locator("#recent-posts")).toBeVisible();
  await expect(page.locator("#hero")).toBeVisible();
  await expect(page.locator("footer")).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
});

test("blog page", async ({ page }) => {
  await page.goto("/blog");
  await expect(page).toHaveTitle(/Posts/);
  await expect(page).toHaveURL("/blog");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("#nav-menu")).toBeVisible();
  await expect(page.locator("#main-content")).toBeVisible();
  await expect(page.getByLabel("breadcrumb")).toBeVisible();
  await expect(page.locator("footer")).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("main > h1")).toBeVisible();
  await expect(page.locator("main > h1")).toHaveText("Posts");
  await expect(page.locator("main > ul")).toBeVisible();
});

test("tags page", async ({ page }) => {
  await page.goto("/tags");
  await expect(page).toHaveTitle(/Tags/);
  await expect(page).toHaveURL("/tags");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("#nav-menu")).toBeVisible();
  await expect(page.getByLabel("breadcrumb")).toBeVisible();
  await expect(page.locator("footer")).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("main > h1")).toBeVisible();
  await expect(page.locator("main > h1")).toHaveText("Tags");
  await expect(page.locator("main > ul")).toBeVisible();
});

test("about page", async ({ page }) => {
  await page.goto("/about");
  await expect(page).toHaveTitle(/About/);
  await expect(page).toHaveURL("/about");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("#nav-menu")).toBeVisible();
  await expect(page.locator("#main-content")).toBeVisible();
  await expect(page.getByLabel("breadcrumb")).toBeVisible();
  await expect(page.locator("footer")).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("main > section")).toBeVisible();
});

test("navigation works from menu", async ({ page }) => {
  await page.goto("/");
  await page.click('a[href="/blog"]');
  await expect(page).toHaveURL("/blog");
  await page.click('a[href="/tags"]');
  await expect(page).toHaveURL("/tags");
  await page.click('a[href="/about"]');
  await expect(page).toHaveURL("/about");
  await page.click('a[href="/search"]');
  await expect(page).toHaveURL("/search");
});

test("404 page shows for unknown route", async ({ page }) => {
  await page.goto("/not-exist-page");
  await expect(page.locator("main")).toContainText(/404|not found/i);
});

test("dark mode toggle works", async ({ page }) => {
  await page.goto("/");
  const toggle = page.locator('#theme-toggle, [aria-label="toggle theme"]');
  if (await toggle.isVisible()) {
    const body = page.locator("body");
    const initial = await body.getAttribute("class");
    await toggle.click();
    const after = await body.getAttribute("class");
    expect(initial).not.toBe(after);
  }
});
test("sanitize: removes script and dangerous HTML from Notion content", async () => {
  // Import sanitize directly for unit test
  const { sanitize } = await import("../helpers/sanitize.mjs");

  const malicious = `
    <div>Safe</div>
    <script>alert('xss')</script>
    <img src="x" onerror="alert('xss')" />
    <a href="javascript:alert('xss')">link</a>
    <iframe src="https://evil.com"></iframe>
    <iframe src="https://youtube.com/embed/abc"></iframe>
    <object data="evil"></object>
    <embed src="evil"></embed>
    <link rel="stylesheet" href="evil.css">
    <meta http-equiv="refresh" content="0;url=evil">
  `;
  const sanitized = sanitize(malicious);

  expect(sanitized).toContain("<div>Safe</div>");
  expect(sanitized).not.toContain("<script");
  expect(sanitized).not.toContain("onerror=");
  expect(sanitized).not.toContain("javascript:");
  expect(sanitized).not.toContain('<iframe src="https://evil.com"></iframe>');
  expect(sanitized).toContain('<iframe src="https://youtube.com/embed/abc"></iframe>');
  expect(sanitized).not.toContain("<object");
  expect(sanitized).not.toContain("<embed");
  expect(sanitized).not.toContain("<link");
  expect(sanitized).not.toContain("<meta");
});

// --- NotionPageSchema validation tests ---
import { NotionPageSchema } from "../libs/notion.types";
import { z } from "zod";

test("NotionPageSchema: valid page passes validation", () => {
  const validPage = {
    id: "abc123",
    title: "Test Title",
    type: "page",
    cover: "https://example.com/image.png",
    tags: [
      { id: "t1", name: "tag1", color: "red" },
      { id: "t2", name: "tag2" }
    ],
    created_time: "2023-01-01T00:00:00.000Z",
    last_edited_time: "2023-01-02T00:00:00.000Z",
    featured: null,
    archived: false,
    status: "published",
    publish_date: "2023-01-01",
    modified_date: "2023-01-02",
    description: "desc",
    slug: "test-title"
  };
  const result = NotionPageSchema.safeParse(validPage);
  expect(result.success).toBe(true);
});

test("NotionPageSchema: invalid page fails validation", () => {
  const invalidPage = {
    id: 123, // should be string
    title: "Test Title",
    type: "page",
    tags: [],
    created_time: "2023-01-01T00:00:00.000Z",
    last_edited_time: "2023-01-02T00:00:00.000Z",
    archived: false,
    slug: "test-title"
    // missing required fields
  };
  const result = NotionPageSchema.safeParse(invalidPage);
  expect(result.success).toBe(false);
});
