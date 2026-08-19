import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import octopage from 'octopage/integration';
import octopageConfig from './octopage.config.ts';

export default defineConfig({
  site: octopageConfig.site.url,
  base: octopageConfig.site.base,

  // `directory` serves /blog/post/ with a trailing slash. giscus reads
  // location.pathname verbatim to find its discussion, so this choice is part
  // of the comment pairing — octopage derives the paired discussion title from
  // whatever is configured here. Changing it orphans existing threads.
  build: { format: 'directory' },

  integrations: [
    react(),
    mdx(),
    sitemap(),
    octopage(octopageConfig),
  ],
});
