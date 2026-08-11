import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: 'html',
  use: {
    baseURL: `http://127.0.0.1:3000`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npx serve src -p 3000`,
    port: 3000,
    reuseExistingServer: false,
  },
});
