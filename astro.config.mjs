import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import octopage from './src/lib/integration.ts';
import octopageConfig from './octopage.config.ts';

export default defineConfig({
  // Where the site is published. `base` is the repository name for a GitHub
  // Pages project site; drop it for a user site, a custom domain, or Vercel.
  site: 'https://ggondim.github.io',
  base: '/octopage',

  // `directory` serves /blog/post/ with a trailing slash. giscus reads
  // location.pathname verbatim to find the thread for a committed page, so this
  // choice is part of comment pairing — changing it orphans existing threads.
  build: { format: 'directory' },

  integrations: [react(), mdx(), sitemap(), octopage(octopageConfig)],
});
