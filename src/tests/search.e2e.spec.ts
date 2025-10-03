import { test, expect } from '@playwright/test';

test.describe('Search page', () => {
  test('performs a search and shows results or debug logs', async ({ page }) => {
    await page.goto('/search');

    const input = page.getByPlaceholder('Search by title, description, or tags...');
    await input.fill('test');

    await page.getByRole('button', { name: 'Search' }).click();

    // Wait for either results or debug element to become visible
    const debug = page.locator('#debug');
    const results = page.locator('#results');

    await Promise.race([
      debug.waitFor({ state: 'visible', timeout: 5000 }),
      results.waitFor({ state: 'visible', timeout: 5000 }),
    ]).catch(() => {});

    // Assert at least one of them is visible
    const debugVisible = await debug.isVisible().catch(() => false);
    const resultsVisible = await results.isVisible().catch(() => false);

    expect(debugVisible || resultsVisible).toBeTruthy();
  });
});
