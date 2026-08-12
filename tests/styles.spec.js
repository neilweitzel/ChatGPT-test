import { test, expect } from '@playwright/test';

test.describe('Computed Styles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('body uses the dark timing-screen palette', async ({ page }) => {
    const body = page.locator('body');
    await expect(body).toHaveCSS('background-color', 'rgb(10, 13, 18)'); // --bg-color
    await expect(body).toHaveCSS('color', 'rgb(238, 242, 247)'); // --text-color
  });

  test('header is centred with an uppercase wordmark and red eyebrow', async ({ page }) => {
    const header = page.locator('header');
    await expect(header).toHaveCSS('text-align', 'center');

    const h1 = header.locator('h1');
    await expect(h1).toHaveCSS('color', 'rgb(238, 242, 247)'); // --text-color
    await expect(h1).toHaveCSS('text-transform', 'uppercase');

    const eyebrow = header.locator('.eyebrow');
    await expect(eyebrow).toHaveCSS('color', 'rgb(255, 43, 31)'); // --primary-color
  });

  test('sections are carbon cards with uppercase titles', async ({ page }) => {
    const section = page.locator('main section.summary');
    await expect(section).toHaveCSS('background-color', 'rgb(19, 26, 35)'); // --surface
    await expect(section).toHaveCSS('border-radius', '10px');

    const h2 = section.locator('h2');
    await expect(h2).toHaveCSS('color', 'rgb(238, 242, 247)');
    await expect(h2).toHaveCSS('text-transform', 'uppercase');
  });

  test('lap times render as tabular monospace figures', async ({ page }) => {
    // A timing screen only reads correctly when digits line up.
    await page.locator('#demo-race-load').click();
    const cell = page.locator('#results tbody tr td').nth(1);
    await expect(cell).toBeVisible();
    await expect(cell).toHaveCSS('font-variant-numeric', 'tabular-nums');
    expect(await cell.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('monospace');
  });

  test('timing colours follow motorsport convention', async ({ page }) => {
    await page.locator('#demo-race-load').click();

    // Purple marks the session best, green a driver's own best.
    await expect(page.locator('#results .overall-best').first()).toHaveCSS(
      'color',
      'rgb(192, 139, 255)'
    );
    await expect(page.locator('#results .personal-best').first()).toHaveCSS(
      'color',
      'rgb(61, 220, 132)'
    );
  });

  test('footer has correct styling', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toHaveCSS('background-color', 'rgb(7, 10, 14)');
    await expect(footer).toHaveCSS('color', 'rgb(174, 187, 203)'); // --secondary-text-color
    await expect(footer).toHaveCSS('text-align', 'center');
  });

  test('visual regression test', async ({ page }) => {
    // Drop test dataset for screenshot
    const fs = (await import('fs')).default;
    const path = (await import('path')).default;
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.join(__dirname, '../dataset/scale_10k_laps.csv');
    const csvContent = fs.readFileSync(filePath, 'utf-8');

    await page.evaluate((content) => {
      const file = new File([content], 'scale_10k_laps.csv', { type: 'text/csv' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const dropzone = document.getElementById('dropzone');
      const e = new Event('drop');
      e.dataTransfer = dt;
      dropzone.dispatchEvent(e);
    }, csvContent);

    // Wait for leaderboard to render to ensure screenshot has the data
    await expect(page.locator('table.leaderboard-table')).toBeVisible();

    // Viewport-sized on purpose. A full-page screenshot's height depends on how
    // text wraps, which differs with the fonts installed on the machine, and a
    // size mismatch fails regardless of the pixel tolerance. The README uses
    // docs/screenshots/ instead, which is generated rather than asserted.
    await expect(page).toHaveScreenshot('homepage.png', { fullPage: false });
  });
});
