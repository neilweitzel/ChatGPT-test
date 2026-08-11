import { test, expect } from '@playwright/test';

test.describe('Guard test', () => {
  test('serves the correct Apex application instead of Codex placeholder', async ({ page }) => {
    await page.goto('/');

    // Ensure we are on the Apex page with the dropzone and not an old placeholder
    const dropzoneCount = await page.locator('#dropzone').count();
    expect(dropzoneCount, 'The page served does not contain the dropzone. It might be serving the wrong directory.').toBeGreaterThan(0);
  });
});
