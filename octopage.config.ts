import { defineConfig } from './src/lib/config.ts';

/**
 * Everything here is optional — `defineConfig({})` is a complete configuration.
 *
 * The repository, the site URL, the base path, the giscus ids and the comment
 * category are all derived at build time from the git remote, astro.config.mjs
 * and the GitHub API. What remains is what cannot be inferred.
 */
export default defineConfig({
  /**
   * A deliberate information architecture, layered over the derived routes.
   * A pinned page is not also published at its derived URL.
   */
  routes: {
    '/custom-place': { entry: 'pages/pinned' },
    '/writing': { redirect: '/blog/hello-octopage' },
    // '/uses': { discussion: 12 },
  },

  /**
   * Narrow which discussions become pages. Left out, every discussion in every
   * category is content, minus threads giscus opened for comments.
   */
  // discussions: {
  //   categories: ['Announcements'],
  //   labels: ['published'],
  //   draftLabel: 'draft',
  //   basePath: '/content',
  // },

  /**
   * Category holding comment threads. Left out, `Announcements` is used when it
   * exists — giscus's own recommendation, since only maintainers can open
   * threads there.
   */
  // comments: 'Announcements',
});
