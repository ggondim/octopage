import { defineConfig, devices } from '@playwright/test';

/**
 * The site is fully static, so the suite runs against the real build output
 * rather than a dev server. `astro preview` serves `dist/` under the configured
 * base path, which means base-path bugs — by far the most common way a working
 * local site breaks on GitHub Pages — are actually reachable by these tests.
 */
const PORT = 4321;
// Matches `base` in astro.config.mjs. The suite serves the built site the way
// the configured host would, so a base-path mistake fails a test rather than a
// deploy.
export const BASE = '';

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
    // OCTOPAGE_OFFLINE keeps the suite off the GitHub API: it asserts on
    // rendering and routing, not on content freshness, and a fork's pull
    // request has no token to reach the API with anyway. Discussion-backed
    // pages are absent under the flag, so every assertion here is about
    // committed content.
    // `astro preview` daemonises as of Astro 7 — the foreground process exits
    // and Playwright treats that as the server dying. scripts/serve.mjs is the
    // same server the Docker vercel profile uses, here with BASE_PATH set so
    // the suite exercises the real GitHub Pages sub-path.
    command: `OCTOPAGE_OFFLINE=1 pnpm build && SERVE_ROOT=dist VERCEL_JSON=vercel.json BASE_PATH=${BASE} PORT=${PORT} node scripts/serve.mjs`,
    url: `http://localhost:${PORT}${BASE}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
  },
});
