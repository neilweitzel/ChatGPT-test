import { test, expect } from '@playwright/test';
import { parseCSV } from '../src/lib/parser.js';
import fs from 'fs';
import path from 'path';

test.describe('CSV Parser', () => {
  test('parses clean session correctly', () => {
    const text = fs.readFileSync(path.join(process.cwd(), 'fixtures/clean_session.csv'), 'utf8');
    const { sessions, errors } = parseCSV(text);

    expect(errors.length).toBe(0);
    expect(sessions.length).toBe(1);

    const session = sessions[0];
    expect(session.id).toBe('Monza-2023-10-01');
    expect(session.track).toBe('Monza');
    expect(session.date).toBe('2023-10-01');
    expect(session.drivers).toEqual(expect.arrayContaining(['Mario', 'Luigi']));
    expect(session.laps.length).toBe(3);

    const lap1 = session.laps[0];
    expect(lap1.lap).toBe(1);
    expect(lap1.time).toBe(85100); // 1:25.100
    expect(lap1.sectors).toEqual([28500, 29100, 27500]);

    const lap2 = session.laps[1];
    expect(lap2.time).toBe(84900); // 84.900
  });

  test('parses messy columns with BOM and CRLF correctly', () => {
    const text = fs.readFileSync(path.join(process.cwd(), 'fixtures/messy_columns.csv'), 'utf8');
    const { sessions, errors } = parseCSV(text);

    expect(errors.length).toBe(0);
    expect(sessions.length).toBe(1);

    const session = sessions[0];
    expect(session.id).toBe('Monza-2023-10-01');
    expect(session.laps.length).toBe(3);

    const lap1 = session.laps.find(l => l.driver === 'Mario' && l.lap === 1);
    expect(lap1.time).toBe(85100);
    expect(lap1.sectors).toEqual([28500, 29100, 27500]); // s1, s2, s3 extracted despite messy columns
  });

  test('collects errors for malformed rows instead of throwing', () => {
    const text = fs.readFileSync(path.join(process.cwd(), 'fixtures/malformed_errors.csv'), 'utf8');
    const { sessions, errors } = parseCSV(text);

    expect(errors.length).toBe(4);

    expect(errors[0].row).toBe(2);
    expect(errors[0].message).toContain('Missing lap number or time');

    expect(errors[1].row).toBe(3);
    expect(errors[1].message).toContain('Invalid time format');

    expect(errors[2].row).toBe(4);
    expect(errors[2].message).toContain('Invalid lap number');

    expect(errors[3].row).toBe(5);
    expect(errors[3].message).toContain('Missing lap number or time');
  });
});

test.describe('E2E Upload UI', () => {
  test('drag and drop upload and persistence', async ({ page }) => {
    await page.goto('/');

    // Wait for the dropzone to be available
    const dropzone = page.locator('#dropzone');
    await expect(dropzone).toBeVisible();

    // Create a data transfer for the file drop
    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer();
      const content = "Track,Date,Driver,Lap,Time,Sector 1,Sector 2,Sector 3\nMonza,2023-10-01,Mario,1,1:25.100,28.500,29.100,27.500";
      const file = new File([content], 'clean_session.csv', { type: 'text/csv' });
      dt.items.add(file);
      return dt;
    });

    // Dispatch the drop event
    await dropzone.dispatchEvent('drop', { dataTransfer });

    // Wait for the results to be rendered
    const results = page.locator('#results');
    await expect(results).toContainText('Sessions');
    await expect(results.locator('h3')).toHaveText('Monza - 2023-10-01');

    // Reload the page to check IndexedDB persistence
    await page.reload();

    // The results should still be there after reload
    await expect(page.locator('#results')).toContainText('Sessions');
    await expect(page.locator('#results').locator('h3')).toHaveText('Monza - 2023-10-01');
  });
});
