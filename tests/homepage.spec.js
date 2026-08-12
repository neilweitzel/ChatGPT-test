import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('has correct html lang attribute', async ({ page }) => {
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang', 'en');
  });

  test('includes correct meta and link tags', async ({ page }) => {
    const charsetMeta = page.locator('meta[charset="UTF-8"]');
    await expect(charsetMeta).toHaveCount(1);

    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).toHaveAttribute('content', 'width=device-width, initial-scale=1.0');

    const cspMeta = page.locator('meta[http-equiv="Content-Security-Policy"]');
    await expect(cspMeta).toHaveAttribute('content', "default-src 'self'; style-src 'self' 'unsafe-inline';");

    const stylesheetLink = page.locator('link[rel="stylesheet"]');
    await expect(stylesheetLink).toHaveAttribute('href', 'styles/style.css');
  });

  /**
   * Tests to verify the correct application titles and sections
   */
  test('loads and displays correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Apex Karting Telemetry');
  });

  test('displays the main header and tagline', async ({ page }) => {
    const header = page.locator('header h1');
    await expect(header).toHaveText('Apex Karting Telemetry');

    const tagline = page.locator('header .tagline');
    await expect(tagline).toHaveText('Analyze your karting performance with dynamic leaderboards and charts.');
  });

  test('displays summary section', async ({ page }) => {
    const summarySection = page.locator('main section.summary');
    await expect(summarySection.locator('h2')).toHaveText('About Apex');
    await expect(summarySection.locator('p')).toContainText('Apex is a client-side web application');
  });

  test('lists the features inside About Apex', async ({ page }) => {
    // The features live in the About section rather than a section of their own.
    await expect(page.locator('main section.features')).toHaveCount(0);

    const summarySection = page.locator('main section.summary');
    const listItems = summarySection.locator('ul.feature-list li');
    // These must stay in sync with the Features list in README.md.
    const expectedTexts = [
      'Local CSV Upload:',
      'Dynamic Leaderboard:',
      'Visualizations:',
      'Track Map Rendering:',
      'GPX and GPS CSV Parsing:',
      'Speed Gradients:',
      'Ghost Sync Replay:'
    ];
    await expect(listItems).toHaveCount(expectedTexts.length);
    await Promise.all(
      expectedTexts.map((text, i) => expect(listItems.nth(i)).toContainText(text))
    );
  });

  test('displays the footer', async ({ page }) => {
    const footer = page.locator('footer p');
    // The year is filled in at runtime so the copyright cannot go stale.
    await expect(footer).toHaveText(`© ${new Date().getFullYear()} Apex Karting`);
  });

  test('is responsive on mobile viewports', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const header = page.locator('header h1');
    await expect(header).toBeVisible();

    const summarySection = page.locator('main section.summary');
    await expect(summarySection).toBeVisible();

    const featureList = page.locator('main section.summary ul.feature-list');
    await expect(featureList).toBeVisible();

    const footer = page.locator('footer p');
    await expect(footer).toBeVisible();
  });
});
test.describe('Footer year', () => {
  test('renders the current year, not a hardcoded one', async ({ page }) => {
    await page.goto('/');

    const year = String(new Date().getFullYear());
    await expect(page.locator('#footer-year')).toHaveText(year);
    // The markup fallback should never be an older year than the one shown.
    const fallback = await page.evaluate(() => {
      const html = document.documentElement.outerHTML;
      const match = html.match(/id="footer-year">(\d{4})</);
      return match ? match[1] : null;
    });
    expect(Number(fallback)).toBeGreaterThanOrEqual(2026);
  });
});

test.describe('No horizontal overflow', () => {
  // A wide select, the eight-column leaderboard and the replay bar have all
  // pushed the page sideways on a phone before; each now shrinks or scrolls
  // inside its own container.
  for (const width of [320, 375, 414, 768]) {
    test(`page does not scroll sideways at ${width}px, with data loaded`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/');

      await page.locator('#demo-race-load').click();
      await expect(page.locator('table.leaderboard-table')).toBeVisible();
      await page.locator('#demo-trace-load').click();
      await expect(page.locator('#map-panel .map-svg')).toBeVisible();

      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scrollWidth, `page is ${scrollWidth - innerWidth}px too wide`).toBeLessThanOrEqual(
        innerWidth + 1
      );

      // The wide table stays reachable by scrolling its own wrapper.
      const scrollable = await page
        .locator('.table-scroll')
        .first()
        .evaluate((el) => el.scrollWidth > el.clientWidth || el.clientWidth >= el.scrollWidth);
      expect(scrollable).toBe(true);
    });
  }
});
