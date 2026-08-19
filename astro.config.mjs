import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import octopage from './src/lib/integration.ts';
import octopageConfig from './octopage.config.ts';

export default defineConfig({
  // This repository publishes as a GitHub Pages *project* page, so it serves
  // under `/octopage` rather than from the root.
  //
  // That is the exception, not the norm — `pnpm setup` defaults a new site to
  // `base: '/'`, which is what a user or organisation page (`<name>.github.io`),
  // a custom domain and Vercel all need. Drop the `base` line for those.
  //
  // It changes more than asset URLs: giscus derives a committed page's comment
  // thread from the full pathname, base included, so changing it later orphans
  // existing threads.
  site: 'https://ggondim.github.io',
  base: '/octopage',

  // `directory` serves /blog/post/ with a trailing slash. giscus reads
  // location.pathname verbatim to find the thread for a committed page, so this
  // choice is part of comment pairing — changing it orphans existing threads.
  build: { format: 'directory' },

  integrations: [react(), mdx(), sitemap(), octopage(octopageConfig)],
});
