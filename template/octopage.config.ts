import { defineConfig } from 'octopage/config';

export default defineConfig({
  site: {
    title: 'Octopage',
    description: 'A static personal site powered by GitHub Discussions and Primer Brand.',
    url: 'https://ggondim.github.io',
    // Project site served from a sub-path. Drop this for a user site
    // (`<user>.github.io`) or a custom domain.
    base: '/octopage',
  },

  repo: { owner: 'ggondim', name: 'octopage' },

  // 'discussions' — write posts as GitHub Discussions, nothing committed.
  // 'code'        — write .mdx under blog/ and pages/, previewable locally.
  source: 'code',

  discussions: {
    contentCategories: ['General'],
    draftLabel: 'draft',
    basePath: '/content',
  },

  code: {
    dirs: ['blog', 'pages'],
    createDiscussions: true,
  },

  // Fill these in from https://giscus.app for your repo, or let
  // `npx create-octopage` resolve them for you. `false` disables comments.
  comments: false,

  // Custom URL tree, layered over the generated routes.
  routes: {},
});
