import { DB_NAME } from '../src/lib/db.js';

/**
 * Clears persisted Apex sessions before the page scripts run.
 *
 * The database name is imported from the app so this never drifts: the specs
 * used to delete a database called `KartingTelemetryDB`, which has never been
 * the name Apex writes to, so the cleanup silently did nothing.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<void>}
 */
export async function clearSessions(page) {
  await page.addInitScript((dbName) => {
    indexedDB.deleteDatabase(dbName);
  }, DB_NAME);
}

/**
 * Drops a file onto the dropzone using a synthetic DataTransfer.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} content - File contents.
 * @param {string} filename - File name, which also drives format detection.
 * @param {string} [type='text/csv'] - MIME type.
 * @returns {Promise<void>}
 */
export async function dropFile(page, content, filename, type = 'text/csv') {
  const dataTransfer = await page.evaluateHandle(
    ({ content, filename, type }) => {
      const dt = new DataTransfer();
      dt.items.add(new File([content], filename, { type }));
      return dt;
    },
    { content, filename, type }
  );
  await page.locator('#dropzone').dispatchEvent('drop', { dataTransfer });
}
