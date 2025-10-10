import { test, expect } from '@playwright/test';

test.describe('About page images', () => {
  test('should load profile image and FCC certificates', async ({ page }) => {
    // Navigate to about page
    await page.goto('http://localhost:4321/about');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check if profile image loads
    const profileImage = page.locator('img[alt="Avatar image"]');
    await expect(profileImage).toBeVisible();
    
    // Check if the image src is accessible
    const profileSrc = await profileImage.getAttribute('src');
    console.log('Profile image src:', profileSrc);
    
    // Navigate to the image URL to check if it loads
    if (profileSrc) {
      const imageResponse = await page.request.get(`http://localhost:4321${profileSrc}`);
      console.log('Profile image response status:', imageResponse.status());
      expect(imageResponse.status()).toBe(200);
    }
    
    // Check FCC certificate images
    const fccImages = page.locator('img').filter({ hasNot: page.locator('img[alt="Avatar image"]') });
    const fccImageCount = await fccImages.count();
    console.log('FCC images found:', fccImageCount);
    
    // Check each FCC image
    for (let i = 0; i < fccImageCount; i++) {
      const fccImage = fccImages.nth(i);
      const fccSrc = await fccImage.getAttribute('src');
      console.log(`FCC image ${i + 1} src:`, fccSrc);
      
      if (fccSrc) {
        const imageResponse = await page.request.get(`http://localhost:4321${fccSrc}`);
        console.log(`FCC image ${i + 1} response status:`, imageResponse.status());
        expect(imageResponse.status()).toBe(200);
      }
    }
  });
  
  test('should show proper error handling for broken images', async ({ page }) => {
    // Listen for console errors
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleMessages.push(msg.text());
      }
    });
    
    // Listen for failed requests
    const failedRequests: string[] = [];
    page.on('requestfailed', request => {
      failedRequests.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
    });
    
    await page.goto('http://localhost:4321/about');
    await page.waitForLoadState('networkidle');
    
    // Log any console errors or failed requests
    if (consoleMessages.length > 0) {
      console.log('Console errors:', consoleMessages);
    }
    
    if (failedRequests.length > 0) {
      console.log('Failed requests:', failedRequests);
    }
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/about-image-debug.png' });
  });
});