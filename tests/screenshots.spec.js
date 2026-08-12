import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { clearSessions } from './helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs/screenshots');

const DEMO_CSV = path.join(ROOT, 'dataset/demo_session.csv');
const DEMO_GPX = path.join(ROOT, 'dataset/demo_lap_trace.gpx');

/**
 * Regenerates the README screenshots from the demo dataset.
 *
 * These are documentation artefacts rather than assertions, so they are tagged
 * @screenshots and excluded from the default test run. Refresh them with
 * `npm run screenshots` after any UI change.
 */
test.describe('README screenshots @screenshots', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  test('capture demo screenshots @screenshots', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await clearSessions(page);
    await page.goto('/');

    // --- Lap session: leaderboard and charts ---
    await page.locator('#file-input').setInputFiles(DEMO_CSV);
    await expect(page.locator('table.leaderboard-table')).toBeVisible();
    await expect(page.locator('.lap-trace-svg')).toBeVisible();

    // Compare the quickest driver against the most consistent one.
    await page.locator('.chart-controls select').nth(0).selectOption('Nina Alvarez');
    await page.locator('.chart-controls select').nth(1).selectOption('Marcus Webb');
    await expect(page.locator('h4', { hasText: 'Sector Delta' })).toContainText(
      'Nina Alvarez vs Marcus Webb'
    );

    // --- GPS trace: track map, speed gradient, ghost replay ---
    await page.locator('#file-input').setInputFiles(DEMO_GPX);
    await expect(page.locator('#map-panel .map-svg')).toBeVisible();
    await expect(page.locator('.replay-controls')).toBeVisible();

    // Park the replay mid-lap so both karts and a real delta are visible.
    const scrubber = page.locator('.replay-scrubber');
    const max = Number(await scrubber.getAttribute('max'));
    await scrubber.fill(String(Math.round(max * 0.45)));
    await scrubber.dispatchEvent('input');
    await expect(page.locator('.replay-delta')).not.toHaveText('+0.000s');

    await page.waitForFunction(() => document.fonts.ready.then(() => true));

    // Individual sections, then a full-page overview.
    await page.locator('section.upload').screenshot({
      path: path.join(OUT_DIR, 'upload.png'),
    });
    await page.locator('#results table.leaderboard-table').screenshot({
      path: path.join(OUT_DIR, 'leaderboard.png'),
    });
    await page.locator('.charts-section').screenshot({
      path: path.join(OUT_DIR, 'charts.png'),
    });
    await page.locator('#map-panel .map-container').screenshot({
      path: path.join(OUT_DIR, 'track-map-replay.png'),
    });
    await page.screenshot({
      path: path.join(OUT_DIR, 'overview.png'),
      fullPage: true,
    });

    for (const name of ['upload', 'leaderboard', 'charts', 'track-map-replay', 'overview']) {
      const file = path.join(OUT_DIR, `${name}.png`);
      expect(fs.existsSync(file), `${name}.png was not written`).toBe(true);
      expect(fs.statSync(file).size, `${name}.png looks empty`).toBeGreaterThan(5_000);
    }
  });
});
