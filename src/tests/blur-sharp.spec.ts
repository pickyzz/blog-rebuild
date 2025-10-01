import { test, expect } from "@playwright/test";

test("blur to sharp effect works on blog posts with navigation", async ({ page }) => {
  // Go to blog page to see available posts
  await page.goto("/blog");

  // Wait for posts to load
  await page.waitForSelector("ul li a#card-url");

  // Get the first post link
  const firstPostLink = page.locator("ul li a#card-url").first();
  const firstHref = await firstPostLink.getAttribute("href");

  if (!firstHref) {
    throw new Error("No posts found");
  }

  console.log(`Testing blur→sharp on first post: ${firstHref}`);

  // Navigate to the first post
  await page.goto(firstHref);

  // Wait for page to load
  await page.waitForSelector("main");

  // Find images with blur effect (img-loading class)
  const blurryImages = page.locator("img.img-loading");

  // If no blurry images, skip test
  const count = await blurryImages.count();
  if (count === 0) {
    console.log("No images with blur effect found on first post");
  } else {
    console.log(`Found ${count} images with blur effect on first post`);

    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await page.waitForTimeout(1000);

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(3000);

    // Check that images have loaded
    const loadedImages = page.locator("img.img-loaded");
    const loadedCount = await loadedImages.count();
    console.log(`First post: ${loadedCount}/${count} images loaded`);

    if (count > 0) {
      expect(loadedCount).toBeGreaterThan(0);
    }
  }

  // Navigate back to blog page for second post test
  await page.goto("/blog");
  await page.waitForSelector("ul li a#card-url");

  // Get second post link (if available)
  const secondPostLink = page.locator("ul li a#card-url").nth(1);
  const secondHref = await secondPostLink.getAttribute("href");

  if (secondHref && secondHref !== firstHref) {
    console.log(`Testing blur→sharp on second post: ${secondHref}`);

    // Navigate to second post
    await page.goto(secondHref);
    await page.waitForSelector("main");

    // Check second post images
    const secondBlurryImages = page.locator("img.img-loading");
    const secondCount = await secondBlurryImages.count();

    if (secondCount > 0) {
      console.log(`Found ${secondCount} images with blur effect on second post`);

      // Wait for images to load (navigation should trigger re-init)
      await page.waitForTimeout(3000);

      const secondLoadedImages = page.locator("img.img-loaded");
      const secondLoadedCount = await secondLoadedImages.count();

      console.log(`Second post: ${secondLoadedCount}/${secondCount} images loaded`);

      // Verify blur→sharp works on navigated page
      expect(secondLoadedCount).toBeGreaterThan(0);
    } else {
      console.log("No images with blur effect found on second post");
    }
  } else {
    console.log("Only one post available, skipping second navigation test");
  }

  console.log("Blur→sharp navigation test completed");
});

test("card hover zoom effect works on index page", async ({ page }) => {
  // Go to index page
  await page.goto("/");

  // Wait for posts to load
  await page.waitForSelector("ul li a#card-url");

  // Get the first card image
  const firstCardImg = page.locator("ul li img.card-animate").first();

  // Check initial transform
  const initialTransform = await firstCardImg.evaluate((img) => {
    const computedStyle = window.getComputedStyle(img);
    return computedStyle.transform;
  });

  console.log(`Initial transform: ${initialTransform}`);

  // Hover over the image
  await firstCardImg.hover();

  // Wait for transition
  await page.waitForTimeout(600);

  // Check transform after hover
  const hoverTransform = await firstCardImg.evaluate((img) => {
    const computedStyle = window.getComputedStyle(img);
    return computedStyle.transform;
  });

  console.log(`Hover transform: ${hoverTransform}`);

  // Verify hover effect worked (transform changed from initial)
  expect(hoverTransform).not.toBe(initialTransform);

  // Extract scale values
  const extractScale = (transform: string) => {
    const match = transform.match(/matrix\(([^,]+),\s*0,\s*0,\s*([^,]+)/);
    return match ? parseFloat(match[1]) : 1;
  };

  const initialScale = extractScale(initialTransform);
  const hoverScale = extractScale(hoverTransform);

  console.log(`Initial scale: ${initialScale}, Hover scale: ${hoverScale}`);

  // Hover should increase or decrease scale (any change indicates hover works)
  expect(Math.abs(hoverScale - initialScale)).toBeGreaterThan(0);

  // Move mouse away to test return to initial state
  await page.mouse.move(0, 0);
  await page.waitForTimeout(600);

  const finalTransform = await firstCardImg.evaluate((img) => {
    const computedStyle = window.getComputedStyle(img);
    return computedStyle.transform;
  });

  console.log(`Final transform: ${finalTransform}`);

  // Should return to initial state
  expect(finalTransform).toBe(initialTransform);

  console.log("Card hover zoom test completed");
});