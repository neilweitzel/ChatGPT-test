import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCSV } from '../src/lib/parser.js';
import { parseGPX, processTelemetry } from '../src/lib/map.js';
import { computeLeaderboard } from '../src/lib/stats.js';
import { clearSessions } from './helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const DEMO_CSV = path.join(ROOT, 'dataset/demo_session.csv');
const DEMO_GPX = path.join(ROOT, 'dataset/demo_lap_trace.gpx');

/**
 * Guards the committed demo data and the claims the README makes about it.
 * If the data is regenerated with different parameters, these fail rather than
 * letting the documentation drift.
 */
test.describe('Demo lap session', () => {
  test('parses cleanly into one realistic session', () => {
    const { sessions, errors } = parseCSV(fs.readFileSync(DEMO_CSV, 'utf8'));

    expect(errors).toEqual([]);
    expect(sessions).toHaveLength(1);

    const [session] = sessions;
    expect(session.track).toBe('Fastimes Indoor Karting');
    expect(session.drivers).toHaveLength(6);
    expect(session.laps).toHaveLength(86);
  });

  test('sector times reconstruct every lap time exactly', () => {
    const { sessions } = parseCSV(fs.readFileSync(DEMO_CSV, 'utf8'));

    for (const lap of sessions[0].laps) {
      expect(lap.sectors).toHaveLength(3);
      const sum = lap.sectors.reduce((a, s) => a + s, 0);
      expect(sum, `${lap.driver} lap ${lap.lap}`).toBe(lap.time);
    }
  });

  test('produces meaningful stats for every driver', () => {
    const { sessions } = parseCSV(fs.readFileSync(DEMO_CSV, 'utf8'));
    const stats = computeLeaderboard(sessions[0]);

    expect(stats.drivers).toHaveLength(6);

    for (const driver of stats.drivers) {
      // Enough laps that median and consistency mean something.
      expect(driver.laps.length).toBeGreaterThanOrEqual(12);
      // Kart lap times, not mis-parsed values.
      expect(driver.bestLap).toBeGreaterThan(25_000);
      expect(driver.bestLap).toBeLessThan(45_000);
      // Real spread, so the lap trace is not a flat line.
      expect(driver.consistency).toBeGreaterThan(0);
      // A full set of sectors, so the theoretical best is populated.
      expect(driver.theoreticalBest).toBeLessThanOrEqual(driver.bestLap);
    }

    // Distinct pace between drivers keeps the leaderboard interesting.
    const bests = stats.drivers.map((d) => d.bestLap);
    expect(new Set(bests).size).toBe(bests.length);
  });
});

test.describe('Demo GPS trace', () => {
  test('segments into three laps with a varied speed profile', () => {
    const points = parseGPX(fs.readFileSync(DEMO_GPX, 'utf8'));
    expect(points.length).toBeGreaterThan(1_000);

    const mapData = processTelemetry(points);
    expect(mapData).not.toBeNull();
    expect(mapData.laps).toHaveLength(3);

    const kph = mapData.points.map((p) => p.speed * 3.6);
    const slowest = Math.min(...kph);
    const fastest = Math.max(...kph);

    // Plausible kart speeds, and a wide enough range for the gradient to read.
    expect(slowest).toBeGreaterThan(5);
    expect(fastest).toBeLessThan(90);
    expect(fastest - slowest).toBeGreaterThan(25);

    // Laps differ in pace, so the ghost replay shows a real delta.
    const lapTimes = mapData.laps.map((lap) => lap[lap.length - 1].t);
    expect(new Set(lapTimes).size).toBe(lapTimes.length);
  });
});

test.describe('Demo data in the application', () => {
  test('renders the full feature set from the two demo files', async ({ page }) => {
    await clearSessions(page);
    await page.goto('/');

    await page.locator('#file-input').setInputFiles(DEMO_CSV);

    // Leaderboard: one row per driver, with theoretical bests populated.
    await expect(page.locator('#results tbody tr')).toHaveCount(6);
    await expect(page.locator('#results h3').first()).toContainText('Fastimes Indoor Karting');
    await expect(page.locator('#upload-status')).toContainText('Loaded 86 laps');

    const theoretical = page.locator('#results tbody tr td:nth-child(6)');
    for (const value of await theoretical.allTextContents()) {
      expect(value).not.toBe('-');
    }

    // Charts: one series per driver in the lap trace legend.
    await expect(page.locator('.lap-trace-svg .chart-legend-label')).toHaveCount(6);
    await expect(page.locator('.sector-delta-svg')).toBeVisible();

    await page.locator('#file-input').setInputFiles(DEMO_GPX);

    // Track map with a speed-coloured line and the gradient legend.
    await expect(page.locator('#map-panel h3')).toContainText('3 laps detected');
    const strokes = await page
      .locator('#map-panel .racing-line line')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('stroke')));
    expect(strokes.length).toBeGreaterThan(500);
    expect(new Set(strokes).size).toBeGreaterThan(20);
    await expect(page.locator('#map-panel .map-legend-bar')).toBeVisible();

    // Ghost replay reports a real, non-zero delta once scrubbed.
    const scrubber = page.locator('.replay-scrubber');
    const max = Number(await scrubber.getAttribute('max'));
    await scrubber.fill(String(Math.round(max * 0.45)));
    await scrubber.dispatchEvent('input');

    const delta = await page.locator('.replay-delta').innerText();
    expect(delta).toMatch(/^[+-]?\d+\.\d{3}s$/);
    expect(Math.abs(parseFloat(delta))).toBeGreaterThan(0.1);

    // The leaderboard is still there alongside the map.
    await expect(page.locator('#results tbody tr')).toHaveCount(6);
  });
});
