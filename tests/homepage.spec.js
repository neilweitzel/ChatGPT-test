const { test, expect } = require('@playwright/test');
const path = require('path');

const filePath = `file://${path.resolve(__dirname, '../index.html')}`;

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(filePath);
  });

  test('includes correct meta and link tags', async ({ page }) => {
    const charsetMeta = page.locator('meta[charset="UTF-8"]');
    await expect(charsetMeta).toHaveCount(1);

    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).toHaveAttribute('content', 'width=device-width, initial-scale=1.0');

    const stylesheetLink = page.locator('link[rel="stylesheet"]');
    await expect(stylesheetLink).toHaveAttribute('href', 'style.css');
  });

  test('loads and displays correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Codex by ChatGPT');
  });

  test('displays the main header and tagline', async ({ page }) => {
    const header = page.locator('header h1');
    await expect(header).toHaveText('Codex by ChatGPT');

    const tagline = page.locator('header .tagline');
    await expect(tagline).toHaveText('Automate pull request creation with natural language.');
  });

  test('displays summary section', async ({ page }) => {
    const summarySection = page.locator('main section.summary');
    await expect(summarySection.locator('h2')).toHaveText('About Codex by ChatGPT');
    await expect(summarySection.locator('p')).toContainText('Codex by ChatGPT helps automate pull request creation');
  });

  test('displays features section', async ({ page }) => {
    const featuresSection = page.locator('main section.features');
    await expect(featuresSection.locator('h2')).toHaveText('Features & Test Cases');

    const listItems = featuresSection.locator('ul li');
    const expectedTexts = [
      'Readme update:',
      'Code change with tests:',
      'Error handling:'
    ];
    await expect(listItems).toHaveCount(expectedTexts.length);
    for (let i = 0; i < expectedTexts.length; i++) {
      await expect(listItems.nth(i)).toContainText(expectedTexts[i]);
    }
  });

  test('displays the footer', async ({ page }) => {
    const footer = page.locator('footer p');
    await expect(footer).toHaveText('© 2023 Codex by ChatGPT');
  });

  test('is responsive on mobile viewports', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const header = page.locator('header h1');
    await expect(header).toBeVisible();

    const summarySection = page.locator('main section.summary');
    await expect(summarySection).toBeVisible();

    const featuresSection = page.locator('main section.features');
    await expect(featuresSection).toBeVisible();

    const footer = page.locator('footer p');
    await expect(footer).toBeVisible();
  });
});