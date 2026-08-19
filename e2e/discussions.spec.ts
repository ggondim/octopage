import { expect, test } from '@playwright/test';

/**
 * The dynamic half of the site.
 *
 * These pages are never built: GitHub Pages serves 404.html for a path with no
 * file, and the island resolves the discussion in the browser. The API is
 * intercepted here so the suite stays hermetic and does not spend the
 * unauthenticated rate limit (60/hour/IP) — what is under test is the
 * resolution and rendering, not GitHub.
 */
const API = 'https://api.github.com/repos/*/**/discussions*';

function discussion(overrides: Record<string, unknown> = {}) {
  return {
    number: 42,
    title: 'From the API',
    body: '<!-- octopage\nslug: from-the-api\n-->\n\nBody text.\n\n<Label size="large" color="green">rendered</Label>',
    html_url: 'https://github.com/o/r/discussions/42',
    created_at: '2026-08-19T00:00:00Z',
    updated_at: '2026-08-19T00:00:00Z',
    author_association: 'OWNER',
    user: { login: 'someone', avatar_url: '', html_url: 'https://github.com/someone' },
    category: { name: 'Announcements', slug: 'announcements', node_id: 'DIC_x', is_answerable: false },
    labels: [],
    comments: 0,
    ...overrides,
  };
}

async function serve(page: import('@playwright/test').Page, body: unknown[]) {
  await page.route(API, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }),
  );
}

test('a discussion resolves at its route with no build behind it', async ({ page }) => {
  await serve(page, [discussion()]);

  await page.goto('content/announcements/from-the-api/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('From the API');
  // The body is MDX compiled in the browser: a component tag became a real
  // Primer component, not escaped text.
  await expect(page.locator('[data-testid="Label"]')).toHaveText('rendered');
});

test('an offline build omits the widget rather than mounting a broken one', async ({ page }) => {
  await serve(page, [discussion()]);

  await page.goto('content/announcements/from-the-api/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // The suite builds with OCTOPAGE_OFFLINE=1, so the repo and category ids
  // giscus needs were never resolved. The page still renders; only comments
  // are absent. The mapping contract itself is asserted in giscus.spec.ts,
  // where it can be checked without a network.
  await expect(page.locator('script[src="https://giscus.app/client.js"]')).toHaveCount(0);
});

test('a discussion from an untrusted author is not published', async ({ page }) => {
  // Anyone with a GitHub account can open a discussion in a public repo, and
  // bodies are compiled as MDX in the reader's browser. author_association is
  // the boundary, and it comes from GitHub — a visitor cannot forge it.
  await serve(page, [discussion({ author_association: 'NONE' })]);

  await page.goto('content/announcements/from-the-api/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Not found');
  await expect(page.locator('[data-testid="Label"]')).toHaveCount(0);
});

test('a draft-labelled discussion is not published', async ({ page }) => {
  await serve(page, [discussion({ labels: [{ name: 'draft', color: 'ccc' }] })]);

  await page.goto('content/announcements/from-the-api/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Not found');
});

test('a giscus comment thread is not published as a page', async ({ page }) => {
  // giscus marks threads it opens with the SHA-1 of their title. Without this
  // filter, every comment thread would appear as a page named after a URL path.
  await serve(page, [
    discussion({
      title: 'octopage/about/',
      body: 'Comments for about.\n\n<!-- sha1: e1caf4400f16088738588a29838781792c964138 -->',
    }),
  ]);

  await page.goto('content/announcements/42/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Not found');
});

test('an unreachable API leaves a readable page, not a blank one', async ({ page }) => {
  await page.route(API, (route) => route.fulfill({ status: 500, body: 'nope' }));

  await page.goto('content/announcements/whatever/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Could not load');
});

test('GitHub Flavoured Markdown renders in a discussion body', async ({ page }) => {
  // GitHub's editor is where these are written, so GFM is simply how markdown
  // works to an author. Astro enables it for committed files; a bare MDX
  // compile does not, and without remark-gfm a table renders as pipes.
  await serve(page, [
    discussion({
      body: '| a | b |\n|---|---|\n| 1 | 2 |\n\n~~gone~~\n\n- [x] done',
    }),
  ]);

  await page.goto('content/announcements/42/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await expect(page.locator('table')).toHaveCount(1);
  await expect(page.locator('del')).toHaveText('gone');
  await expect(page.locator('input[type=checkbox]')).toHaveCount(1);
});
