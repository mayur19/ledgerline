import { defineConfig, devices } from '@playwright/test';

const webPort = process.env.WEB_PORT ?? '5101';
const baseURL = `http://localhost:${webPort}`;

/**
 * Smoke tests against a locally running stack (./run.sh e2e). Not part of CI yet:
 * browser binaries are not installed on the runner (LL-104).
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { outputFolder: './report', open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    cwd: '..',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
