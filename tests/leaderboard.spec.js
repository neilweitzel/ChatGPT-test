import { test, expect } from '@playwright/test';

test.describe('Leaderboard UI', () => {
  test('renders table, handles styling and accessible sort behavior', async ({ page }) => {
    await page.goto('/');

    const dropzone = page.locator('#dropzone');
    await expect(dropzone).toBeVisible();

    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer();
      const content = `Track,Date,Driver,Lap,Time,Sector 1,Sector 2,Sector 3
Monza,2023-10-01,Alice,1,1:25.000,28.000,29.000,28.000
Monza,2023-10-01,Alice,2,1:26.000,28.500,29.000,28.500
Monza,2023-10-01,Bob,1,1:25.000,28.100,28.900,28.000
Monza,2023-10-01,Charlie,1,1:30.000,,,`;
      const file = new File([content], 'leaderboard_test.csv', { type: 'text/csv' });
      dt.items.add(file);
      return dt;
    });

    await dropzone.dispatchEvent('drop', { dataTransfer });

    const table = page.locator('.leaderboard-table');
    await expect(table).toBeVisible();

    // Check purple and green highlights
    // Alice and Bob tied for overall best (1:25.000) -> 2 cells
    // Sector overall bests: Alice [28.0, None, None], Bob [None, 28.9, 28.0] -> 3 cells
    // Note: overallBestSectors is calculated across all drivers.
    // Overall best sectors: [28.0, 28.9, 28.0]
    // Alice s1: 28.0 (overall best)
    // Bob s2: 28.9 (overall best)
    // Bob s3: 28.0 (overall best)
    // Alice s3: 28.0 (overall best) -> Alice and Bob tie for s3 overall best
    // Total overall best sector cells = 1(s1) + 1(s2) + 2(s3) = 4 cells
    // Total overall best cells = 2 (Best Lap) + 4 (Sectors) = 6 cells
    const overallBests = table.locator('td.overall-best');
    await expect(overallBests).toHaveCount(6);

    // Personal best sectors not overall:
    // Alice s2: 29.0
    // Bob s1: 28.1
    // Charlie best lap: 1:30.000
    // Total personal bests = 1 (Alice s2) + 1 (Bob s1) + 1 (Charlie best lap) = 3 cells
    const personalBests = table.locator('td.personal-best');
    await expect(personalBests).toHaveCount(3);

    // Default sort is bestLap asc, tie-breaker is driver name
    let firstRowDriver = table.locator('tbody tr:nth-child(1) td:nth-child(1)');
    let secondRowDriver = table.locator('tbody tr:nth-child(2) td:nth-child(1)');
    await expect(firstRowDriver).toHaveText('Alice');
    await expect(secondRowDriver).toHaveText('Bob');

    // Test Keyboard Accessibility (Enter key on Driver header to sort by Driver desc)
    const driverHeader = table.locator('th', { hasText: 'Driver' });

    // Sort asc first
    await driverHeader.focus();
    await page.keyboard.press('Enter');
    await expect(driverHeader).toHaveAttribute('aria-sort', 'ascending');

    // Sort desc
    await page.keyboard.press('Space'); // Test spacebar too
    await expect(driverHeader).toHaveAttribute('aria-sort', 'descending');

    firstRowDriver = table.locator('tbody tr:nth-child(1) td:nth-child(1)');
    await expect(firstRowDriver).toHaveText('Charlie');
  });
});
