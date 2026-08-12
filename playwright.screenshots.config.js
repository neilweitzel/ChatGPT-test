import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

/**
 * Configuration for regenerating the README screenshots.
 *
 * Reuses the app config (web server, viewport) but selects only the
 * @screenshots spec, which the default run excludes.
 */
export default defineConfig({
  ...base,
  grep: /@screenshots/,
  grepInvert: undefined,
  reporter: 'list',
  workers: 1,
});
