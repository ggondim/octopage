import { defineCollection } from 'astro:content';
import { z } from 'zod';
import { glob } from 'astro/loaders';
import { discussionsLoader } from './lib/discussions-loader.ts';
import { parseConfig } from './lib/config.ts';
import userConfig from '../octopage.config.ts';

const config = parseConfig(userConfig);

/**
 * Metadata shared by both sources. Only `title` is required: a discussion is a
 * legitimate page with nothing but a title, and a committed file should not
 * have to restate what its path already says.
 */
const shared = {
  title: z.string(),
  description: z.string().optional(),
  date: z.coerce.date().optional(),
  updated: z.coerce.date().optional(),
  author: z.string().nullable().optional(),
  authorUrl: z.string().nullable().optional(),
  authorAvatar: z.string().nullable().optional(),
  category: z.string().optional(),
  labels: z.array(z.string()).default([]),
  route: z.string().optional(),
  slug: z.string().optional(),
  draft: z.boolean().default(false),
};

/** Committed content: `src/content/blog`, `src/content/pages`, anything else you add. */
const pages = defineCollection({
  loader: glob({ base: './src/content', pattern: '**/*.{md,mdx}' }),
  schema: z.object(shared),
});

/** Live content: the repository's Discussions, read at build time. */
const discussions = defineCollection({
  loader: discussionsLoader(config),
  schema: z.object({
    ...shared,
    body: z.string(),
    discussion: z.number(),
    discussionUrl: z.string(),
    upvotes: z.number().optional(),
  }),
});

export const collections = { pages, discussions };
