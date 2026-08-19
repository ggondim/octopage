import { expect, test } from '@playwright/test';

test.describe('rendering', () => {
  test('home lists content and applies the Primer theme attribute', async ({ page }) => {
    await page.goto('.');

    await expect(page).toHaveTitle(/Octopage/);
    // Primer Brand themes off this attribute alone — no React context involved.
    await expect(page.locator('body')).toHaveAttribute('data-color-mode', 'auto');
    await expect(page.getByRole('link', { name: 'Hello, octopage' })).toBeVisible();
  });

  test('a prose page ships no JavaScript', async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(request.url());
    });

    await page.goto('blog/hello-octopage/');
    await page.waitForLoadState('networkidle');

    // The whole point of rendering Primer's presentational components through
    // Astro instead of hydrating them: a text page costs zero client JS.
    expect(scripts).toEqual([]);
  });

  test('Primer Brand styles are actually applied, not just class names', async ({ page }) => {
    await page.goto('blog/hello-octopage/');

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();

    const fontFamily = await heading.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(fontFamily).toContain('Mona Sans');
  });
});

test.describe('routing', () => {
  test('files under pages/ are served from the site root', async ({ page }) => {
    const response = await page.goto('about/');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();
  });

  test('every asset is served under the configured base path', async ({ page }) => {
    await page.goto('blog/hello-octopage/');

    const hrefs = await page.locator('link[rel="stylesheet"]').evaluateAll((els) =>
      els.map((el) => el.getAttribute('href') ?? ''),
    );

    expect(hrefs.length).toBeGreaterThan(0);
    // A base-path regression makes these absolute-from-root and the deployed
    // project site loses all styling while localhost looks perfect.
    for (const href of hrefs) expect(href).toMatch(/^\/octopage\//);
  });
});
