import { test, expect } from '@playwright/test';
import { parseCSV } from '../src/lib/parser.js';
import { parseGPX, parseGPSCSV, processTelemetry } from '../src/lib/map.js';
import { computeLeaderboard } from '../src/lib/stats.js';
import { mergeSession } from '../src/lib/db.js';
import { clearSessions, dropFile } from './helpers.js';

/**
 * Regression coverage for defects found while reviewing the application.
 * Each test names the incorrect behaviour it prevents from returning.
 */
test.describe('Parser: sector alignment', () => {
  test('keeps sector times in their own slot when a sector is missing', () => {
    // A lap with S1 and S3 but no S2 previously reported the S3 time as S2.
    const csv = [
      'Track,Date,Driver,Lap,Time,Sector 1,Sector 2,Sector 3',
      'Monza,2023-10-01,Mario,1,1:25.100,28.500,,27.500',
    ].join('\n');

    const { sessions, errors } = parseCSV(csv);
    expect(errors).toEqual([]);

    const [lap] = sessions[0].laps;
    expect(lap.sectors).toEqual([28500, null, 27500]);
  });

  test('accepts alternative sector header spellings', () => {
    const csv = ['Driver,Lap,Time,S1,Sector2,sec 3', 'Mario,1,1:25.100,28.500,29.100,27.500'].join('\n');

    const { sessions } = parseCSV(csv);
    expect(sessions[0].laps[0].sectors).toEqual([28500, 29100, 27500]);
  });
});

test.describe('Stats: theoretical best', () => {
  test('computes a theoretical best on a two-sector track', () => {
    // The sector count used to be hardcoded to three, so any track with a
    // different number of sectors reported no theoretical best at all.
    const csv = [
      'Track,Date,Driver,Lap,Time,Sector 1,Sector 2',
      'Kart Track,2023-10-01,Mario,1,60.000,31.000,29.000',
      'Kart Track,2023-10-01,Mario,2,59.500,30.500,29.000',
    ].join('\n');

    const { sessions } = parseCSV(csv);
    const stats = computeLeaderboard(sessions[0]);
    const mario = stats.drivers.find((d) => d.driver === 'Mario');

    expect(mario.bestSectors).toEqual([30500, 29000]);
    expect(mario.theoreticalBest).toBe(59500);
  });

  test('leaves the theoretical best empty when a sector is never set', () => {
    const csv = [
      'Track,Date,Driver,Lap,Time,Sector 1,Sector 2,Sector 3',
      'Monza,2023-10-01,Mario,1,1:25.100,28.500,29.100,27.500',
      'Monza,2023-10-01,Luigi,1,1:26.000,,,',
    ].join('\n');

    const { sessions } = parseCSV(csv);
    const stats = computeLeaderboard(sessions[0]);

    expect(stats.drivers.find((d) => d.driver === 'Luigi').theoreticalBest).toBeNull();
    expect(stats.drivers.find((d) => d.driver === 'Mario').theoreticalBest).toBe(85100);
  });
});

test.describe('GPX parsing', () => {
  test('never borrows a later point timestamp for a point without a time', () => {
    // The old regex matched lazily across element boundaries, so a point with
    // no <time> silently took the next point's timestamp and coordinates drifted.
    const gpx = `<gpx><trk><trkseg>
      <trkpt lat="1.000" lon="2.000"><ele>10</ele></trkpt>
      <trkpt lat="1.001" lon="2.001"><time>2023-01-01T00:00:01Z</time></trkpt>
    </trkseg></trk></gpx>`;

    const points = parseGPX(gpx);
    expect(points).toHaveLength(1);
    expect(points[0].lat).toBeCloseTo(1.001, 6);
    expect(points[0].time).toBe(Date.parse('2023-01-01T00:00:01Z'));
  });

  test('handles reversed attribute order and single quotes', () => {
    const gpx = `<gpx><trkpt lon='2.5' lat='1.5'><time>2023-01-01T00:00:02Z</time></trkpt></gpx>`;
    const [point] = parseGPX(gpx);
    expect(point.lat).toBeCloseTo(1.5, 6);
    expect(point.lon).toBeCloseTo(2.5, 6);
  });

  test('returns an empty list for input without track points', () => {
    expect(parseGPX('')).toEqual([]);
    expect(parseGPX('<gpx></gpx>')).toEqual([]);
  });
});

test.describe('GPS CSV parsing', () => {
  test('skips unparseable rows instead of producing NaN geometry', () => {
    const csv = [
      'Lat,Lon,Time',
      '0.0000,0.0000,1000',
      'n/a,,2000',
      '0.0010,0.0000,3000',
      '0.0010,0.0010,4000',
    ].join('\n');

    const points = parseGPSCSV(csv);
    expect(points).toHaveLength(3);
    expect(points.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))).toBe(true);

    const mapData = processTelemetry(points);
    expect(mapData).not.toBeNull();
    expect(mapData.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  });

  test('accepts both numeric offsets and date strings for time', () => {
    const numeric = parseGPSCSV('Lat,Lon,Time\n0,0,1000\n0.001,0,2000');
    expect(numeric[0].time).toBe(1000);

    const dated = parseGPSCSV('Lat,Lon,Time\n0,0,2023-01-01T00:00:01Z\n0.001,0,2023-01-01T00:00:02Z');
    expect(dated[0].time).toBe(Date.parse('2023-01-01T00:00:01Z'));
  });

  test('returns null from processTelemetry when there is nothing usable', () => {
    expect(processTelemetry([])).toBeNull();
    expect(processTelemetry(null)).toBeNull();
    expect(processTelemetry([{ lat: NaN, lon: 0, time: 0 }, { lat: 1, lon: 1, time: 1 }])).toBeNull();
  });
});

test.describe('Storage: session merging', () => {
  test('merges laps for the same session instead of replacing them', () => {
    const existing = {
      id: 'Monza-2023-10-01',
      track: 'Monza',
      date: '2023-10-01',
      drivers: ['Alice'],
      laps: [{ lap: 1, time: 85000, sectors: [], driver: 'Alice' }],
    };
    const incoming = {
      id: 'Monza-2023-10-01',
      track: 'Monza',
      date: '2023-10-01',
      drivers: ['Bob'],
      laps: [{ lap: 1, time: 86000, sectors: [], driver: 'Bob' }],
    };

    const merged = mergeSession(existing, incoming);
    expect(merged.drivers.sort()).toEqual(['Alice', 'Bob']);
    expect(merged.laps).toHaveLength(2);
  });

  test('is idempotent for a repeated upload of the same lap', () => {
    const session = {
      id: 'Monza-2023-10-01',
      drivers: ['Alice'],
      laps: [{ lap: 1, time: 85000, sectors: [], driver: 'Alice' }],
    };

    const merged = mergeSession(session, session);
    expect(merged.laps).toHaveLength(1);
    expect(merged.drivers).toEqual(['Alice']);
  });

  test('keeps both drivers after two separate uploads in the browser', async ({ page }) => {
    await clearSessions(page);
    await page.goto('/');

    await dropFile(page, 'Track,Date,Driver,Lap,Time\nMonza,2023-10-01,Alice,1,1:25.000', 'alice.csv');
    await expect(page.locator('#results tbody tr')).toHaveCount(1);

    await dropFile(page, 'Track,Date,Driver,Lap,Time\nMonza,2023-10-01,Bob,1,1:26.000', 'bob.csv');
    await expect(page.locator('#results tbody tr')).toHaveCount(2);

    const drivers = await page.locator('#results tbody tr td:nth-child(1)').allTextContents();
    expect(drivers.sort()).toEqual(['Alice', 'Bob']);
  });
});

test.describe('Charts: tooltip lifecycle', () => {
  test('reuses one tooltip element across re-renders', async ({ page }) => {
    await clearSessions(page);
    await page.goto('/');

    const csv = [
      'Track,Date,Driver,Lap,Time,Sector 1,Sector 2,Sector 3',
      'Monza,2023-10-01,Alice,1,1:25.000,28.000,29.000,28.000',
      'Monza,2023-10-01,Alice,2,1:25.500,28.200,29.100,28.200',
      'Monza,2023-10-01,Bob,1,1:26.000,28.500,29.200,28.300',
      'Monza,2023-10-01,Bob,2,1:26.500,28.600,29.300,28.600',
    ].join('\n');

    await dropFile(page, csv, 'session.csv');
    await expect(page.locator('.lap-trace-svg')).toBeVisible();

    // Re-render the charts a few times through the driver selectors.
    for (const driver of ['Bob', 'Alice', 'Bob']) {
      await page.locator('.chart-controls select').first().selectOption(driver);
    }

    // One shared tooltip, not one leaked per render.
    await expect(page.locator('.chart-tooltip')).toHaveCount(1);

    // Delegated hover still fills and hides the tooltip.
    await page.locator('.lap-trace-svg circle').first().hover({ force: true });
    const tooltip = page.locator('.chart-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Lap:');
    await expect(tooltip).toContainText('S1:');

    await page.locator('header h1').hover();
    await expect(tooltip).toBeHidden();
  });
});

test.describe('Upload accessibility', () => {
  test('dropzone opens the file picker via keyboard activation', async ({ page }) => {
    await clearSessions(page);
    await page.goto('/');

    const dropzone = page.locator('#dropzone');
    await expect(dropzone).toHaveAttribute('role', 'button');

    // A role="button" element must do something when activated. Intercept the
    // click the dropzone forwards to the hidden input.
    await page.evaluate(() => {
      window.__pickerOpened = 0;
      document.getElementById('file-input').addEventListener('click', (e) => {
        e.preventDefault();
        window.__pickerOpened += 1;
      });
    });

    await dropzone.focus();
    await page.keyboard.press('Enter');
    await dropzone.press(' ');
    await dropzone.click();

    expect(await page.evaluate(() => window.__pickerOpened)).toBe(3);
  });
});
