const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    const filePath = `file://${path.resolve(__dirname, '../index.html')}`;
    await page.goto(filePath);
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
    await expect(listItems).toHaveCount(3);
    await expect(listItems.nth(0)).toContainText('Readme update:');
    await expect(listItems.nth(1)).toContainText('Code change with tests:');
    await expect(listItems.nth(2)).toContainText('Error handling:');
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

  test('loads stylesheet and applies styles', async ({ page }) => {
    const body = page.locator('body');
    await expect(body).toHaveCSS('background-color', 'rgb(243, 244, 246)');
  });
});
