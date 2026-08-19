import { glob } from 'astro/loaders';
import type { OctopageConfig } from './config.ts';
import { SYNC_DIR } from './sync/discussions-to-mdx.ts';

/**
 * The content loader for the configured source mode.
 *
 * Both modes end up on Astro's stock `glob()` loader over files on disk, which
 * is the whole point of syncing discussions down to MDX first: one loader, one
 * MDX pipeline, one set of behaviours to reason about.
 *
 * The two branches differ in `base` for a reason that is easy to trip over:
 * `.octopage` is a dot directory, and glob implementations exclude dotfiles by
 * default. Pointing `base` *at* the directory keeps every path segment in the
 * pattern itself dot-free, so the files are matched without needing a `dot`
 * option the loader does not expose.
 */
export function octopageContentLoader(config: OctopageConfig) {
  if (config.source === 'discussions') {
    return glob({ base: `./${SYNC_DIR}`, pattern: '**/*.{md,mdx}' });
  }

  return glob({
    base: '.',
    pattern: config.code.dirs.map((dir) => `${dir}/**/*.{md,mdx}`),
  });
}
