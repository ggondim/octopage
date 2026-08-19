import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import octopage from './src/lib/integration.ts';
import octopageConfig from './octopage.config.ts';

export default defineConfig({
  // Where the site is published. Serving from the root is the default because
  // it is the only setup that works everywhere: a user or organisation page
  // (`<name>.github.io`), a custom domain, and Vercel all serve from `/`.
  //
  // A GitHub Pages *project* page is the exception — it lives under `/<repo>`,
  // so add `base: '/your-repo'` for that. Be aware it changes more than asset
  // URLs: giscus derives a committed page's comment thread from the full
  // pathname, base included, so changing it later orphans existing threads.
  site: 'https://octopage.github.io',

  // `directory` serves /blog/post/ with a trailing slash. giscus reads
  // location.pathname verbatim to find the thread for a committed page, so this
  // choice is part of comment pairing — changing it orphans existing threads.
  build: { format: 'directory' },

  integrations: [react(), mdx(), sitemap(), octopage(octopageConfig)],
});
