import { defineConfig, type ReporterDescription } from '@playwright/test';

const previewHost = process.env.OPENCLAW_HOSTNAME || process.env.HOSTNAME || '127.0.0.1';
const previewPort = process.env.OPENCLAW_PORT || process.env.PORT || '3218';
const previewBaseUrl = `http://${previewHost}:${previewPort}`;
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.OPENCLAW_PREVIEW_URL ||
  previewBaseUrl;

const reporter: ReporterDescription[] = [['list']];

if (process.env.PLAYWRIGHT_JSON_REPORT) {
  reporter.push(['json', { outputFile: process.env.PLAYWRIGHT_JSON_REPORT }]);
}

if (process.env.PLAYWRIGHT_HTML_REPORT) {
  reporter.push(['html', { open: 'never', outputFolder: process.env.PLAYWRIGHT_HTML_REPORT }]);
}

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter,
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || 'playwright-results',
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
    viewport: {
      width: 1440,
      height: 960,
    },
  },
});
