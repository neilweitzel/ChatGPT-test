const { test, expect } = require('@playwright/test');

test.describe('Computed Styles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('body has correct background and text color', async ({ page }) => {
    const body = page.locator('body');
    await expect(body).toHaveCSS('background-color', 'rgb(243, 244, 246)'); // #f3f4f6
    await expect(body).toHaveCSS('color', 'rgb(31, 41, 55)'); // #1f2937
  });

  test('header has correct styling', async ({ page }) => {
    const header = page.locator('header');
    await expect(header).toHaveCSS('background-color', 'rgb(255, 255, 255)'); // #ffffff
    await expect(header).toHaveCSS('text-align', 'center');

    const h1 = header.locator('h1');
    await expect(h1).toHaveCSS('color', 'rgb(37, 99, 235)'); // #2563eb
  });

  test('sections have correct card styling', async ({ page }) => {
    const section = page.locator('main section.summary');
    await expect(section).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(section).toHaveCSS('border-radius', '8px');

    const h2 = section.locator('h2');
    await expect(h2).toHaveCSS('color', 'rgb(37, 99, 235)');
  });

  test('footer has correct styling', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toHaveCSS('background-color', 'rgb(31, 41, 55)'); // var(--text-color)
    await expect(footer).toHaveCSS('color', 'rgb(255, 255, 255)'); // #fff
    await expect(footer).toHaveCSS('text-align', 'center');
  });

  test('visual regression test', async ({ page }) => {
    await expect(page).toHaveScreenshot('homepage.png');
  });
});
