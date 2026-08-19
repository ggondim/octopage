import { expect, test } from '@playwright/test';
import { BASE } from '../playwright.config.ts';

test.describe('rendering', () => {
  test('home lists content and applies the Primer theme attribute', async ({ page }) => {
    await page.goto('.');

    // The title comes from package.json's `name`, not from a config field.
    await expect(page).toHaveTitle(/octopage/i);
    // Primer Brand themes off this attribute alone — no React context involved.
    await expect(page.locator('body')).toHaveAttribute('data-color-mode', 'auto');
    await expect(page.getByRole('link', { name: 'Hello, octopage' })).toBeVisible();
  });

  test('a prose page ships no first-party JavaScript', async ({ page }) => {
    const scripts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(request.url());
    });

    await page.goto('blog/hello-octopage/');
    await page.waitForLoadState('networkidle');

    // The claim being locked here is about the page itself: rendering Primer's
    // presentational components through Astro rather than hydrating them means
    // no bundle is emitted for a text page at all.
    //
    // giscus is deliberately excluded. It is a third-party script that loads
    // only where comments are enabled, and it is the reader's opt-in cost for
    // having comments — not something the rendering approach can avoid.
    const firstParty = scripts.filter((url) => !url.startsWith('https://giscus.app/'));
    expect(firstParty).toEqual([]);
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

    // giscus injects `https://giscus.app/default.css` into the *parent*
    // document, not only into its iframe, so the set has to be narrowed to
    // first-party stylesheets before asserting anything about the base path.
    const firstParty = hrefs.filter((href) => href.startsWith('/'));

    expect(firstParty.length).toBeGreaterThan(0);
    // Asserted against the configured base rather than a literal, so this keeps
    // catching the regression whichever way the site is deployed: an asset URL
    // that loses its base 404s on a project page, and one that gains a base it
    // should not have 404s at a root deploy. Both look perfect on localhost.
    for (const href of firstParty) expect(href.startsWith(`${BASE}/`)).toBe(true);
  });
});

test.describe('custom URL tree', () => {
  test('a pinned entry is served at its pin, and not at its path', async ({ page }) => {
    const pinned = await page.goto('custom-place/');
    expect(pinned?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'Pinned page' })).toBeVisible();

    // The pin wins outright — publishing the same page at both URLs would split
    // its comment thread, since giscus pairs on the pathname.
    const byPath = await page.goto('pinned/');
    expect(byPath?.status()).toBe(404);
  });

  test('a redirect target keeps the base path', async ({ page }) => {
    await page.goto('writing/');
    // Astro applies `base` to the redirect source but emits the destination
    // verbatim, so this is the assertion that catches a target losing its base
    // and 404ing only once deployed under one.
    await expect(page).toHaveURL(new RegExp(`${BASE}/blog/hello-octopage`));
  });
});
