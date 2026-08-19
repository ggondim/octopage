import { defineConfig, devices } from '@playwright/test';

/**
 * The site is fully static, so the suite runs against the real build output
 * rather than a dev server. `astro preview` serves `dist/` under the configured
 * base path, which means base-path bugs — by far the most common way a working
 * local site breaks on GitHub Pages — are actually reachable by these tests.
 */
const PORT = 4321;
const BASE = '/octopage';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    // The trailing slash is load-bearing: Playwright resolves each test URL
    // with `new URL(path, baseURL)`, and a leading-slash path against a
    // baseURL of `.../octopage` resolves to the origin root, quietly dropping
    // the base path. Tests therefore use relative paths ('blog/post/'), and
    // this must end in '/'.
    baseURL: `http://localhost:${PORT}${BASE}/`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  webServer: {
    // OCTOPAGE_OFFLINE keeps the suite from hitting the GitHub API on every
    // run: tests assert on rendering and routing, not on content freshness.
    command: 'OCTOPAGE_OFFLINE=1 pnpm --filter octopage-template build && pnpm --filter octopage-template preview --port ' + PORT,
    url: `http://localhost:${PORT}${BASE}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
  },
});
