import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: 'html',
  use: {
    baseURL: `http://127.0.0.1:3000`,
    trace: 'on-first-retry',
    // Pin the rendering surface so snapshots do not depend on defaults.
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  },
  expect: {
    /**
     * Visual baselines are committed from a developer machine but verified on CI
     * runners, which install a different set of system fonts. That shifts text
     * antialiasing and metrics by a small percentage of pixels on every text
     * heavy screenshot. A tolerance keeps the baselines useful for catching
     * layout breakage without failing on font rendering; exact styling is
     * asserted separately through computed-style checks in styles.spec.js.
     */
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.1,
      animations: 'disabled',
      scale: 'css',
    },
  },
  webServer: {
    command: `npx serve src -p 3000`,
    port: 3000,
    reuseExistingServer: false,
  },
});
