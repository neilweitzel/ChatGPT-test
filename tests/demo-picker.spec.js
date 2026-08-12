import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { normalizeManifest, optionLabel, findEntry } from '../src/lib/demo-manifest.js';
import { clearSessions } from './helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'src/demo/manifest.json');

/** @returns {Object} The committed manifest. */
function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

test.describe('Demo manifest handling', () => {
  test('keeps well-formed entries and reports both kinds', () => {
    const { races, traces } = normalizeManifest(readManifest());

    expect(races.length).toBeGreaterThanOrEqual(3);
    expect(traces.length).toBeGreaterThanOrEqual(2);
    for (const entry of [...races, ...traces]) {
      expect(entry.file).toBeTruthy();
      expect(entry.label).toBeTruthy();
      expect(entry.detail).toBeTruthy();
    }
  });

  test('drops malformed entries and rejects paths that escape the demo directory', () => {
    const { races, traces } = normalizeManifest({
      races: [
        { file: 'ok.csv', label: 'Fine' },
        { file: '../../etc/passwd', label: 'Traversal' },
        { file: 'nested/path.csv', label: 'Nested' },
        { file: '', label: 'Empty name' },
        { file: 'no-label.csv' },
        null,
      ],
      traces: [{ file: 'trace.gpx', label: 'Trace', replay: false }],
    });

    expect(races.map((r) => r.file)).toEqual(['ok.csv']);
    expect(traces[0].replay).toBe(false);
  });

  test('tolerates a missing or malformed manifest', () => {
    expect(normalizeManifest(null)).toEqual({ races: [], traces: [] });
    expect(normalizeManifest({})).toEqual({ races: [], traces: [] });
    expect(normalizeManifest({ races: 'nope' })).toEqual({ races: [], traces: [] });
  });

  test('builds option text and finds entries by file', () => {
    const entry = { file: 'a.csv', label: 'Track', detail: '6 drivers' };
    expect(optionLabel(entry)).toBe('Track (6 drivers)');
    expect(optionLabel({ file: 'b.csv', label: 'Bare' })).toBe('Bare');
    expect(findEntry([entry], 'a.csv')).toBe(entry);
    expect(findEntry([entry], 'missing.csv')).toBeNull();
  });
});

test.describe('Demo data sync', () => {
  test('src/demo matches dataset', () => {
    // Fails with instructions if someone edits dataset/ without re-syncing.
    const output = execFileSync('node', ['scripts/sync-demo-data.js', '--check'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    expect(output).toContain('in sync');
  });

  test('every manifest entry points at a file that exists and parses', () => {
    const { races, traces } = normalizeManifest(readManifest());

    for (const entry of [...races, ...traces]) {
      const served = path.join(ROOT, 'src/demo', entry.file);
      const source = path.join(ROOT, 'dataset', entry.file);

      expect(fs.existsSync(served), `${entry.file} missing from src/demo`).toBe(true);
      expect(fs.existsSync(source), `${entry.file} missing from dataset`).toBe(true);
      expect(fs.readFileSync(served)).toEqual(fs.readFileSync(source));
    }
  });

  test('manifest details agree with the underlying data', () => {
    const { races } = normalizeManifest(readManifest());

    for (const race of races) {
      const text = fs.readFileSync(path.join(ROOT, 'dataset', race.file), 'utf8');
      const rows = text.trim().split('\n').length - 1;
      expect(race.laps, `${race.file} lap count`).toBe(rows);
      expect(race.detail).toContain(`${race.laps} laps`);
      expect(race.detail).toContain(`${race.drivers} drivers`);
    }
  });
});

test.describe('Demo picker in the app', () => {
  test.beforeEach(async ({ page }) => {
    await clearSessions(page);
    await page.goto('/');
  });

  test('offers every bundled race and trace', async ({ page }) => {
    const manifest = normalizeManifest(readManifest());
    const section = page.locator('section.demo');

    await expect(section).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('#demo-race option')).toHaveCount(manifest.races.length);
    await expect(page.locator('#demo-trace option')).toHaveCount(manifest.traces.length);

    // Option text carries the summary, so a race can be chosen on merit.
    await expect(page.locator('#demo-race option').first()).toHaveText(
      optionLabel(manifest.races[0])
    );
    await expect(page.locator('#demo-status')).toContainText(
      `${manifest.races.length} races and ${manifest.traces.length} lap traces`
    );
  });

  test('views a selected race', async ({ page }) => {
    const { races } = normalizeManifest(readManifest());
    const race = races[1];

    await page.locator('#demo-race').selectOption(race.file);
    await page.locator('#demo-race-load').click();

    await expect(page.locator('#results table.leaderboard-table')).toBeVisible();
    await expect(page.locator('#results tbody tr')).toHaveCount(race.drivers);
    await expect(page.locator('#results h3').first()).toContainText(race.track);
    await expect(page.locator('#upload-status')).toContainText(`Loaded ${race.laps} laps`);
    await expect(page.locator('#demo-status')).toContainText(`Showing ${race.label}`);
    await expect(page.locator('.lap-trace-svg')).toBeVisible();
  });

  test('replays a selected lap trace and starts playback', async ({ page }) => {
    const { traces } = normalizeManifest(readManifest());
    const trace = traces[traces.length - 1];

    await page.locator('#demo-trace').selectOption(trace.file);
    await page.locator('#demo-trace-load').click();

    await expect(page.locator('#map-panel .map-svg')).toBeVisible();
    await expect(page.locator('#map-panel h3')).toContainText(`${trace.laps} laps detected`);

    // Autoplay: the shared control has flipped to Pause and the delta is live.
    await expect(page.locator('.replay-play-btn')).toHaveText('Pause');
    await expect(page.locator('.replay-marker-a')).toBeVisible();
    await expect(page.locator('.replay-marker-b')).toBeVisible();

    await expect
      .poll(async () => Number(await page.locator('.replay-scrubber').inputValue()))
      .toBeGreaterThan(0);
  });

  test('a race and a trace can be loaded together', async ({ page }) => {
    const { races, traces } = normalizeManifest(readManifest());

    await page.locator('#demo-race').selectOption(races[0].file);
    await page.locator('#demo-race-load').click();
    await expect(page.locator('#results tbody tr')).toHaveCount(races[0].drivers);

    await page.locator('#demo-trace').selectOption(traces[0].file);
    await page.locator('#demo-trace-load').click();
    await expect(page.locator('#map-panel .map-svg')).toBeVisible();

    // Both panels remain populated.
    await expect(page.locator('#results tbody tr')).toHaveCount(races[0].drivers);
  });

  test('loading several races keeps each session on the leaderboard', async ({ page }) => {
    const { races } = normalizeManifest(readManifest());

    for (const race of races) {
      await page.locator('#demo-race').selectOption(race.file);
      await page.locator('#demo-race-load').click();
      await expect(page.locator('#demo-status')).toContainText(`Showing ${race.label}`);
    }

    // Each race is a distinct track/date session, so all are listed.
    await expect(page.locator('#results table.leaderboard-table')).toHaveCount(races.length);
  });

  test('reports a clear error when a demo file cannot be fetched', async ({ page }) => {
    await page.route('**/demo/demo_session.csv', (route) => route.fulfill({ status: 404 }));

    await page.locator('#demo-race').selectOption('demo_session.csv');
    await page.locator('#demo-race-load').click();

    const status = page.locator('#demo-status');
    await expect(status).toContainText('Could not load');
    await expect(status).toHaveClass(/status-error/);
    // The button recovers rather than staying stuck in its loading state.
    await expect(page.locator('#demo-race-load')).toBeEnabled();
    await expect(page.locator('#demo-race-load')).toHaveText('View race');
  });

  test('hides the demo section when no manifest is available', async ({ page }) => {
    await page.route('**/demo/manifest.json', (route) => route.fulfill({ status: 404 }));
    await page.goto('/');

    await expect(page.locator('section.demo')).toBeHidden();
    // The rest of the app still works.
    await expect(page.locator('#dropzone')).toBeVisible();
  });
});
