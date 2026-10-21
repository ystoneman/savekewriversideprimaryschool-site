const { defineConfig, devices } = require('@playwright/test');
const baseURL = `https://127.0.0.1:${process.env.KEW_TEST_PORT || 4173}`;

module.exports = defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  timeout: 45_000,
  expect: { timeout: 5_000 },
  outputDir: process.env.KEW_TEST_OUTPUT_DIR || 'test-results',
  reporter: [[process.env.CI ? 'line' : 'list'], ['html', {
    open: 'never', outputFolder: process.env.KEW_TEST_REPORT_DIR || 'playwright-report',
  }]],
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
  },
  webServer: {
    command: 'node tests/browser/server.js',
    url: baseURL,
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'ignore',
  },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'] }, testIgnore: ['**/desktop.spec.js', '**/no-javascript.spec.js'] },
    { name: 'android-chromium', use: { ...devices['Pixel 7'] }, testIgnore: ['**/desktop.spec.js', '**/no-javascript.spec.js'] },
    { name: 'desktop-chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } }, testIgnore: ['**/mobile.spec.js', '**/no-javascript.spec.js'] },
    { name: 'desktop-webkit', use: { browserName: 'webkit', viewport: { width: 1440, height: 1000 } }, testIgnore: ['**/mobile.spec.js', '**/no-javascript.spec.js'] },
    { name: 'iphone-no-javascript', use: { ...devices['iPhone 13'], javaScriptEnabled: false }, testMatch: ['**/legal-fund.spec.js', '**/seo.spec.js', '**/no-javascript.spec.js', '**/qr.spec.js', '**/fundraising-briefs.spec.js', '**/old-site-redirect.spec.js', '**/rally.spec.js'] },
  ],
});
