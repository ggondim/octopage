import { expect, test } from '@playwright/test';
import { giscusAttributes, giscusPathnameTerm } from '../packages/octopage/src/giscus.ts';
import { mappingForSource } from '../packages/octopage/src/config.ts';

/**
 * These lock the one behaviour that fails silently in production: giscus
 * computes its search term in the browser from `location.pathname`, so any
 * disagreement between that and the discussion title we generate at build time
 * shows an empty comment box rather than an error.
 */
test.describe('giscus term derivation', () => {
  test('mirrors the giscus client for the shapes Astro emits', () => {
    expect(giscusPathnameTerm('/')).toBe('index');
    // Directory build format keeps the trailing slash — and so does the term.
    expect(giscusPathnameTerm('/blog/post/')).toBe('blog/post/');
    expect(giscusPathnameTerm('/blog/post')).toBe('blog/post');
    // File build format: the extension is stripped, the leading slash is not
    // re-added.
    expect(giscusPathnameTerm('/blog/post.html')).toBe('blog/post');
    // A base path is part of the pathname, so it is part of the term.
    expect(giscusPathnameTerm('/octopage/blog/post/')).toBe('octopage/blog/post/');
  });
});

test('the widget is absent while comments are disabled', async ({ page }) => {
  await page.goto('blog/hello-octopage/');
  // The template ships with `comments: false`; rendering an empty section with
  // a heading over it would be worse than rendering nothing.
  await expect(page.locator('.octopage-comments')).toHaveCount(0);
});

test.describe('giscus attributes', () => {
  const base = {
    repo: 'ggondim/octopage' as const,
    repoId: 'R_kgDOT9xceg',
    category: 'General',
    categoryId: 'DIC_kwDOT9xces4DDvvd',
  };

  test('the mapping follows the source mode, and is not independently settable', () => {
    // The two have to agree for a comment thread to resolve at all: in
    // discussions mode the page *is* a discussion (pair by number); in code
    // mode the discussion is created for the page (pair by pathname).
    expect(mappingForSource('discussions')).toBe('number');
    expect(mappingForSource('code')).toBe('pathname');
  });

  test('a discussion number travels in data-term under the number mapping', () => {
    const attrs = giscusAttributes({ ...base, mapping: 'number', term: '42' });
    expect(attrs['data-mapping']).toBe('number');
    // giscus's client reads attributes.term and assigns it to params.number —
    // there is no data-number attribute.
    expect(attrs['data-term']).toBe('42');
  });

  test('the pathname mapping carries no term — the browser derives it', () => {
    const attrs = giscusAttributes({ ...base, mapping: 'pathname' });
    expect(attrs['data-term']).toBeUndefined();
  });

  test('booleans are emitted as giscus expects, not as "true"/"false"', () => {
    const attrs = giscusAttributes({ ...base, mapping: 'pathname', strict: true, reactionsEnabled: false });
    // giscus compares against the string '1'; 'true' silently reads as off.
    expect(attrs['data-strict']).toBe('1');
    expect(attrs['data-reactions-enabled']).toBe('0');
  });
});
