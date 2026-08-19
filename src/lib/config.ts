import { z } from 'zod';

/**
 * A node in the custom URL tree — the one thing that cannot be derived.
 *
 * Everything else about a page (its route, its metadata, whether it has
 * comments) follows from where it lives. A deliberate information architecture
 * does not, so this is the one place the author has to say what they mean.
 */
const routeTargetSchema = z.union([
  z.object({ discussion: z.number().int().positive() }),
  z.object({ entry: z.string().min(1) }),
  z.object({ redirect: z.string().min(1) }),
]);

export const octopageConfigSchema = z.object({
  /**
   * Narrow which discussions become pages. Omitted, every discussion in every
   * category is content — the repository is the site, so the default is to
   * publish what is in it rather than make the author opt each page in.
   */
  discussions: z
    .object({
      categories: z.array(z.string()).optional(),
      labels: z.array(z.string()).optional(),
      /** Discussions carrying this label are skipped. */
      draftLabel: z.string().default('draft'),
      /** URL prefix for discussion-backed pages. */
      basePath: z.string().default('/content'),
    })
    .prefault({}),

  /**
   * Category name that holds comment threads.
   *
   * giscus requires a category id, and there is no API to create a category, so
   * this can only ever point at one that already exists. Left out, the build
   * picks `Announcements` when present — giscus's own recommendation, since
   * only maintainers can open threads there — and otherwise the first
   * non-answerable category.
   */
  comments: z.string().min(1).optional(),

  /** Custom URL tree, layered over the derived routes. */
  routes: z.record(z.string(), routeTargetSchema).prefault({}),
});

export type OctopageConfig = z.infer<typeof octopageConfigSchema>;
export type OctopageUserConfig = z.input<typeof octopageConfigSchema>;
export type RouteTarget = z.infer<typeof routeTargetSchema>;

/** Everything is optional; `defineConfig({})` is a complete configuration. */
export function defineConfig(config: OctopageUserConfig = {}): OctopageUserConfig {
  return config;
}

export function parseConfig(config: unknown): OctopageConfig {
  const result = octopageConfigSchema.safeParse(config ?? {});
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid octopage.config.ts:\n${issues}`);
  }
  return result.data;
}
