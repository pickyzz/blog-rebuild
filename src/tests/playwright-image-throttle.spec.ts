import { test, expect } from "@playwright/test";

// Increase test timeout for slow network emulation
test.setTimeout(120000);

// This test loads the index page under Slow 3G and captures console logs.
test("image preload under throttled network", async ({ page }) => {
  await page.context().grantPermissions(["clipboard-read"]);

  // Emulate a Slow 3G network (CDP only)
  try {
    const client = await page.context().newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 400, // 400ms
      downloadThroughput: (500 * 1024) / 8, // ~500kbps
      uploadThroughput: (500 * 1024) / 8,
    });
  } catch (e) {
    console.warn("Could not set network throttling via CDP", e);
  }

  // Capture console messages
  const logs: string[] = [];
  page.on("console", msg => {
    logs.push(`${msg.type()}: ${msg.text()}`);
  });

  // Use domcontentloaded to avoid waiting for all images to finish
  await page.goto("http://localhost:4321/", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(20000); // wait for images to attempt loads

  // Save logs as test artifact
  console.log("Captured console logs:\n", logs.join("\n"));

  // Basic assertion to ensure page loaded
  await expect(page).toHaveTitle(/Pickyzz/);
});
