const { defineConfig } = require('@playwright/test');

const port = process.env.PORT || Math.floor(Math.random() * (60000 - 10000 + 1)) + 10000;
process.env.PORT = port;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npx serve src -p ${port}`,
    port: parseInt(port, 10),
    reuseExistingServer: !process.env.CI,
  },
});
