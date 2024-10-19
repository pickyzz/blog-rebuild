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
  await expect(page.locator("main > h1")).toHaveText("Blog");
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

test("search page", async ({ page }) => {
  await page.goto("/search");
  await expect(page).toHaveTitle(/Search/);
  await expect(page).toHaveURL("/search");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("#nav-menu")).toBeVisible();
  await expect(page.locator("#main-content")).toBeVisible();
  await expect(page.getByLabel("breadcrumb")).toBeVisible();
  await expect(page.locator("footer")).toBeVisible();
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("main > h1")).toBeVisible();
  await expect(page.locator("main > h1")).toHaveText("Search");
});
