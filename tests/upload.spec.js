import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { clearSessions, dropFile } from './helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LAP_CSV = `Track,Date,Driver,Lap,Time,Sector 1,Sector 2,Sector 3
Monza,2023-10-01,Alice,1,1:25.000,28.000,29.000,28.000
Monza,2023-10-01,Alice,2,1:26.000,28.500,29.000,28.500
Monza,2023-10-01,Bob,1,1:25.400,28.100,28.900,28.400`;

test.describe('Upload routing', () => {
  test.beforeEach(async ({ page }) => {
    await clearSessions(page);
    await page.goto('/');
  });

  test('accepts a lap CSV from the file picker and reports status', async ({ page }) => {
    await page.locator('#file-input').setInputFiles({
      name: 'clean_session.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(LAP_CSV, 'utf8'),
    });

    await expect(page.locator('table.leaderboard-table')).toBeVisible();
    await expect(page.locator('#upload-status')).toContainText('Loaded 3 laps from clean_session.csv');
  });

  test('renders the track map, speed gradient, and replay from a GPX file', async ({ page }) => {
    const gpxPath = path.join(__dirname, '../fixtures/kart_track.gpx');
    await page.locator('#file-input').setInputFiles(gpxPath);

    await expect(page.locator('#map-panel .map-svg')).toBeVisible();
    await expect(page.locator('#map-panel h3')).toContainText('laps detected');

    // Speed gradient: the racing line is drawn as individually coloured segments.
    const segments = page.locator('#map-panel .racing-line line');
    expect(await segments.count()).toBeGreaterThan(1);
    const colors = await segments.evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute('stroke'))
    );
    expect(new Set(colors).size).toBeGreaterThan(1);

    // Gradient legend is present.
    await expect(page.locator('#map-panel .map-legend-bar')).toBeVisible();

    // Ghost replay controls with both markers.
    await expect(page.locator('.replay-controls')).toBeVisible();
    await expect(page.locator('.replay-marker-a')).toHaveCount(1);
    await expect(page.locator('.replay-marker-b')).toHaveCount(1);
    await expect(page.locator('#upload-status')).toContainText('GPS points from kart_track.gpx');
  });

  test('keeps the leaderboard and the track map visible at the same time', async ({ page }) => {
    await dropFile(page, LAP_CSV, 'session.csv');
    await expect(page.locator('#results table.leaderboard-table')).toBeVisible();

    await page.locator('#file-input').setInputFiles(path.join(__dirname, '../fixtures/kart_track.gpx'));
    await expect(page.locator('#map-panel .map-svg')).toBeVisible();

    // The leaderboard survives the GPS upload, and vice versa.
    await expect(page.locator('#results table.leaderboard-table')).toBeVisible();
    await expect(page.locator('#results')).toContainText('Sessions');
  });

  test('routes lap data containing "lat" to the leaderboard, not the map', async ({ page }) => {
    const trickyCsv = `Track,Date,Driver,Lap,Time
Atlanta Motorsports Park,2023-10-01,Latoya,1,1:25.100
Atlanta Motorsports Park,2023-10-01,Latoya,2,1:24.900`;

    await dropFile(page, trickyCsv, 'atlanta.csv');

    await expect(page.locator('#results table.leaderboard-table')).toBeVisible();
    await expect(page.locator('#map-panel .map-svg')).toHaveCount(0);
  });

  test('reports unrecognized files instead of failing silently', async ({ page }) => {
    await dropFile(page, 'name,email\nAda,ada@example.com', 'contacts.csv');

    const status = page.locator('#upload-status');
    await expect(status).toContainText('Unrecognized file: contacts.csv');
    await expect(status).toHaveClass(/status-error/);
  });

  test('lists row-level parse errors for malformed lap data', async ({ page }) => {
    const malformed = fs.readFileSync(path.join(__dirname, '../fixtures/malformed_errors.csv'), 'utf8');
    await dropFile(page, malformed, 'malformed_errors.csv');

    const errors = page.locator('#parse-errors');
    await expect(errors).toBeVisible();
    await expect(errors.locator('li').first()).toContainText('Row');
  });

  test('highlights the dropzone while dragging', async ({ page }) => {
    const dropzone = page.locator('#dropzone');
    await dropzone.dispatchEvent('dragover');
    await expect(dropzone).toHaveClass(/dragover/);

    await dropzone.dispatchEvent('dragleave');
    await expect(dropzone).not.toHaveClass(/dragover/);
  });
});
