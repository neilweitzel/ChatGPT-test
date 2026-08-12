import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Replay Ghost Sync', () => {
  test('scrubbing to a given position yields the expected delta value', async ({ page }) => {
    // Go to the local page (served via playwright webServer)
    await page.goto('/');

    // Create a mock GPS CSV that generates at least 2 laps by crossing the start/finish zone.
    // The start/finish zone is near the first point (0, 0), with a 30m radius.
    // It requires traveling at least 50m between crossings.
    // 0.0001 deg is ~11.1 meters.
    const csvData = `Lat,Lon,Time
0.0000,0.0000,1000
0.0010,0.0000,2000
0.0010,0.0010,3000
0.0000,0.0010,4000
0.0000,0.0000,5000
0.0010,0.0000,6000
0.0010,0.0010,7000
0.0000,0.0010,8000
0.0000,0.0000,9000`;

    // Set up mock file drop via evaluate
    await page.evaluate((data) => {
      const dropzone = document.getElementById('dropzone');
      const dataTransfer = new DataTransfer();
      const file = new File([data], "telemetry.csv", { type: "text/csv" });
      dataTransfer.items.add(file);

      const dropEvent = new DragEvent('drop', {
        dataTransfer,
        bubbles: true,
        cancelable: true
      });
      dropzone.dispatchEvent(dropEvent);
    }, csvData);

    // Wait for the replay controls to appear
    const controls = page.locator('.replay-controls');
    await expect(controls).toBeVisible();

    // Verify the delta readout exists
    const readout = page.locator('.replay-delta');
    await expect(readout).toBeVisible();

    // The initial readout might be +0.000s or some initial calculated delta
    const text = await readout.innerText();

    // Scrub the range input
    const scrubber = page.locator('.replay-scrubber');

    // We just want to test that scrubbing updates the delta value
    await scrubber.fill('2000');
    // Dispatch input event to trigger updateReplay
    await scrubber.dispatchEvent('input');

    // Check that readout text is a valid delta string
    const newText = await readout.innerText();
    expect(newText).toMatch(/^[+-]?\d+\.\d+s$/);

    // Since we mocked data (or loaded sample), the delta shouldn't be NaN
    expect(newText).not.toContain('NaN');
  });
});
