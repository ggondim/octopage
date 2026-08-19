import { expect, test } from '@playwright/test';
import { giscusPathnameTerm } from '../packages/octopage/src/giscus.ts';

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
