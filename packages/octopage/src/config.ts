import { z } from 'zod';
import type { GiscusInputPosition } from './giscus.ts';

/**
 * Where content comes from.
 *
 * - `discussions`: the repository's Discussions are the source of truth. Nothing
 *   is committed; the build syncs discussions down to MDX before Astro runs.
 * - `code`: `.mdx` files in the repository are the source of truth, so they can
 *   be previewed in a local dev server before publishing. The build creates the
 *   paired discussion that giscus will attach comments to.
 */
export const sourceModeSchema = z.enum(['discussions', 'code']);
export type SourceMode = z.infer<typeof sourceModeSchema>;

const repoSchema = z.object({
  owner: z.string().min(1),
  name: z.string().min(1),
});

/**
 * A node in the custom URL tree. Both source modes support pointing an
 * arbitrary route at a specific discussion, which is how a hand-built
 * information architecture ("/about", "/uses") coexists with the generated
 * `/content/[category]/[id]` or folder-derived routes.
 */
const routeTargetSchema = z.union([
  z.object({ discussion: z.number().int().positive() }),
  z.object({ entry: z.string().min(1) }),
  z.object({ redirect: z.string().min(1) }),
]);

const commentsSchema = z.union([
  z.literal(false),
  z.object({
    /** Defaults to the content repo when omitted. */
    repo: repoSchema.optional(),
    /** From https://giscus.app — this is not derivable offline. */
    repoId: z.string().min(1),
    category: z.string().min(1),
    categoryId: z.string().min(1),
    strict: z.boolean().default(true),
    reactionsEnabled: z.boolean().default(true),
    inputPosition: z.custom<GiscusInputPosition>().default('bottom'),
    lang: z.string().default('en'),
    /**
     * `preferred_color_scheme` keeps the iframe in step with Primer Brand's
     * `data-color-mode="auto"`, which is itself driven by the OS.
     */
    theme: z.string().default('preferred_color_scheme'),
  }),
]);

export const octopageConfigSchema = z.object({
  site: z.object({
    title: z.string().min(1),
    description: z.string().default(''),
    /** Absolute origin, e.g. `https://ggondim.github.io`. Used for canonical URLs and RSS. */
    url: z.string().url(),
    /** Sub-path for GitHub Pages project sites, e.g. `/octopage`. */
    base: z.string().default('/'),
    author: z.string().optional(),
    lang: z.string().default('en'),
  }),

  repo: repoSchema,

  source: sourceModeSchema,

  discussions: z
    .object({
      /**
       * Discussion categories whose discussions become pages. Categories left
       * out (Q&A, Announcements used for comments, …) are ignored by the sync.
       */
      contentCategories: z.array(z.string().min(1)).default(['General']),
      /** Skip discussions that carry this label — a lightweight unpublish. */
      draftLabel: z.string().default('draft'),
      /** URL prefix for generated routes: `/content/[category]/[id]`. */
      basePath: z.string().default('/content'),
    })
    .prefault({}),

  code: z
    .object({
      /** Directories scanned for `.mdx`, relative to the site root. */
      dirs: z.array(z.string().min(1)).default(['blog', 'pages']),
      /**
       * Whether the build creates the paired discussion for pages that do not
       * have one yet. Requires a token with `discussions: write`.
       */
      createDiscussions: z.boolean().default(true),
    })
    .prefault({}),

  comments: commentsSchema.default(false),

  /** Custom URL tree, layered over the generated routes. */
  routes: z.record(z.string(), routeTargetSchema).default({}),
});

export type OctopageConfig = z.infer<typeof octopageConfigSchema>;
export type OctopageUserConfig = z.input<typeof octopageConfigSchema>;
export type RouteTarget = z.infer<typeof routeTargetSchema>;

/**
 * Identity function that gives editors full type inference over
 * `octopage.config.ts`. Validation happens in the integration, so a config
 * error surfaces as one readable Astro error rather than a stack trace out of
 * a loader.
 */
export function defineConfig(config: OctopageUserConfig): OctopageUserConfig {
  return config;
}

export function parseConfig(config: unknown): OctopageConfig {
  const result = octopageConfigSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid octopage.config.ts:\n${issues}`);
  }
  return result.data;
}

/**
 * The giscus mapping each source mode requires.
 *
 * In `discussions` mode the page *is* a discussion, so it pairs by number and
 * needs no title convention. In `code` mode the discussion is created for the
 * page, so it pairs by the pathname term.
 */
export function mappingForSource(source: SourceMode): 'number' | 'pathname' {
  return source === 'discussions' ? 'number' : 'pathname';
}
