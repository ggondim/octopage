import { defineCollection } from 'astro:content';
import { z } from 'zod';
import { glob } from 'astro/loaders';
/**
 * Committed content only. Discussions are not a build-time collection: they are
 * read in the browser, so publishing one needs no rebuild — see
 * src/components/DiscussionPage.tsx.
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

const pages = defineCollection({
  loader: glob({ base: './src/content', pattern: '**/*.{md,mdx}' }),
  schema: z.object(shared),
});

export const collections = { pages };
