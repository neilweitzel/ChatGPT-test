const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    const filePath = `file://${path.resolve(__dirname, '../index.html')}`;
    await page.goto(filePath);
  });

  test('loads and displays correct title', async ({ page }) => {
    await expect(page).toHaveTitle('My Personal Blog');
  });

  test('displays the main header and tagline', async ({ page }) => {
    const header = page.locator('header h1');
    await expect(header).toHaveText('My Personal Blog');

    const tagline = page.locator('header .tagline');
    await expect(tagline).toHaveText('Thoughts, stories, and ideas.');
  });

  test('displays blog posts', async ({ page }) => {
    const articles = page.locator('main article.post');
    await expect(articles).toHaveCount(2);

    await expect(articles.nth(0).locator('h2')).toHaveText('Welcome to my blog!');
    await expect(articles.nth(1).locator('h2')).toHaveText('Another Post');
  });
});
