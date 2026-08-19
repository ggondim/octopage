// Astro re-exports zod as `astro:content`, but that is a virtual module and
// only resolves inside a site. Importing zod directly keeps this package
// type-checkable on its own; astro 7 depends on zod ^4.3.6 and this package on
// ^4.4.3, so both sides speak the same schema format.
import { z } from 'zod';

/**
 * Schema shared by both source modes.
 *
 * Everything except `title` is optional because a discussion is a legitimate
 * page with nothing but a title — the sync fills the rest in from discussion
 * metadata, and a hand-written `.mdx` should not be forced to restate what the
 * file path already says.
 */
export const octopageSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  date: z.coerce.date().optional(),
  updated: z.coerce.date().optional(),

  author: z.string().nullable().optional(),
  authorUrl: z.string().nullable().optional(),
  authorAvatar: z.string().nullable().optional(),

  category: z.string().optional(),
  categorySlug: z.string().optional(),
  labels: z.array(z.string()).default([]),

  /** Explicit route override; otherwise derived from the file path. */
  route: z.string().optional(),
  slug: z.string().optional(),

  /** Present when the page is backed by a discussion. */
  discussion: z.number().optional(),
  discussionUrl: z.string().optional(),

  upvotes: z.number().optional(),
  commentCount: z.number().optional(),

  source: z.enum(['discussions', 'code']).optional(),
  draft: z.boolean().default(false),
});

export type OctopageEntry = z.infer<typeof octopageSchema>;
