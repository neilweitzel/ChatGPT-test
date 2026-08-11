import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Charts rendering', () => {
  test.beforeEach(async ({ page }) => {
    // Clear IndexedDB
    await page.addInitScript(async () => {
      await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase('KartingTelemetryDB');
        req.onsuccess = resolve;
        req.onerror = resolve;
        req.onblocked = resolve;
      });
    });
    await page.goto('/');
  });

  test('should render lap trace and sector delta charts', async ({ page }) => {
    const filePath = path.join(__dirname, '../fixtures/leaderboard_test.csv');

    // Instead of fetch, let's read file in node and pass content to page.
    const csvContent = fs.readFileSync(filePath, 'utf-8');

    await page.evaluate((content) => {
      const file = new File([content], 'leaderboard_test.csv', { type: 'text/csv' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const dropzone = document.getElementById('dropzone');
      const e = new Event('drop');
      e.dataTransfer = dt;
      dropzone.dispatchEvent(e);
    }, csvContent);

    // Wait for leaderboard and charts to render
    await expect(page.locator('table.leaderboard-table')).toBeVisible();
    await expect(page.locator('.charts-section')).toBeVisible();

    // Verify SVGs are present
    await expect(page.locator('.lap-trace-svg')).toBeVisible();
    await expect(page.locator('.sector-delta-svg')).toBeVisible();

    // Test driver selection
    const selA = page.locator('.chart-controls select').nth(0);
    const selB = page.locator('.chart-controls select').nth(1);

    await selA.selectOption('Alice');
    await selB.selectOption('Bob');

    // Check if the title updated
    await expect(page.locator('h4', { hasText: 'Sector Delta: Alice vs Bob' })).toBeVisible();

    // Visual Regression test
    const chartsSection = page.locator('.charts-section');
    await expect(chartsSection).toHaveScreenshot('charts-section.png', {
      maxDiffPixelRatio: 0.1
    });

    // Test tooltip (hover over a point)
    // using force to override intercepting by another element at same coords
    const firstCircle = page.locator('.lap-trace-svg circle').first();
    await firstCircle.hover({ force: true });

    const tooltip = page.locator('.chart-tooltip').last();
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Lap:');
  });
});
