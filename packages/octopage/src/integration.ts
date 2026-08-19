import type { AstroIntegration } from 'astro';
import { fileURLToPath } from 'node:url';
import { mappingForSource, parseConfig, type OctopageConfig, type OctopageUserConfig } from './config.ts';
import { giscusAttributes, type GiscusConfig } from './giscus.ts';
import { syncDiscussionsToMdx, SYNC_DIR } from './sync/discussions-to-mdx.ts';
import { pairDiscussions } from './sync/pair-discussions.ts';

const VIRTUAL_ID = 'octopage:config';
const RESOLVED_VIRTUAL_ID = '\0octopage:config';

export interface IntegrationOptions {
  /**
   * Skip the GitHub round-trip. Useful for offline work and for CI that only
   * type-checks; in `discussions` mode the site then builds from whatever the
   * previous sync left on disk.
   */
  offline?: boolean;
}

/**
 * The octopage Astro integration.
 *
 * Both source modes converge on the same rendering pipeline — `glob()` plus
 * `@astrojs/mdx` over files on disk. All this does is make sure the files and
 * the paired discussions exist before Astro looks at them, and expose the
 * resolved config to the site through a virtual module.
 */
export default function octopage(
  userConfig: OctopageUserConfig,
  options: IntegrationOptions = {},
): AstroIntegration {
  const config: OctopageConfig = parseConfig(userConfig);

  // Captured in `astro:config:setup`, consumed again in `astro:build:start`.
  let siteRoot = process.cwd();
  let trailingSlash = true;

  return {
    name: 'octopage',
    hooks: {
      'astro:config:setup': async ({ updateConfig, logger, command, config: astroConfig }) => {
        siteRoot = fileURLToPath(astroConfig.root);
        // Astro's directory build format serves `/blog/post/`; the file format
        // serves `/blog/post.html`. giscus reads whichever one the browser is
        // on, so the paired discussion title has to follow the same choice.
        trailingSlash = astroConfig.build.format === 'directory';
        updateConfig({
          vite: {
            resolve: {
              // The ESM build imports its own stylesheets as side effects. Left
              // external, Node's SSR loader reaches those .css files directly
              // and fails with "Unknown file extension .css" — Vite has to
              // bundle the package so its CSS goes through the CSS pipeline.
              // (This lived under `ssr.noExternal` before Vite 8 moved it here.)
              noExternal: ['@primer/react-brand'],
              alias: [
                {
                  // @primer/react-brand's "." export is CJS (lib/index.js); the
                  // ESM build sits behind the "./esm" subpath. Astro's SSR pass
                  // imports the package as ESM, and named imports off the CJS
                  // barrel fail there with "does not provide an export named
                  // 'Heading'". Aliasing lets site authors write the import the
                  // Primer docs document, and keeps a single copy of the library
                  // in the bundle.
                  //
                  // The regex is anchored on both ends deliberately: a loose
                  // prefix match would also rewrite the stylesheet and font
                  // imports (`@primer/react-brand/lib/css/main.css`,
                  // `.../fonts/fonts.css`), which only exist under the CJS tree.
                  find: /^@primer\/react-brand$/,
                  replacement: '@primer/react-brand/esm',
                },
              ],
            },
            plugins: [
              {
                name: 'octopage:virtual-config',
                resolveId(id: string) {
                  if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;
                  return null;
                },
                load(id: string) {
                  if (id !== RESOLVED_VIRTUAL_ID) return null;
                  return [
                    `export const config = ${JSON.stringify(config)};`,
                    `export const giscus = ${JSON.stringify(giscusBaseConfig(config))};`,
                    `export default config;`,
                  ].join('\n');
                },
              },
            ],
          },
        });

        if (options.offline || process.env.OCTOPAGE_OFFLINE === '1') {
          logger.warn('Offline mode — skipping GitHub sync. Content on disk may be stale.');
          return;
        }

        // `astro sync` and `astro check` also land here; running the fetch for
        // them keeps generated content and generated types in agreement.
        if (config.source === 'discussions') {
          try {
            const result = await syncDiscussionsToMdx({
              root: siteRoot,
              config,
              log: (m) => logger.info(m),
            });
            logger.info(`${result.written} page(s) synced into ${SYNC_DIR}`);
          } catch (error) {
            // In dev, a failed fetch should not take the whole server down —
            // the previous sync is usually still good enough to keep working.
            if (command === 'dev') logger.warn(`Discussion sync failed: ${(error as Error).message}`);
            else throw error;
          }
        }
      },

      'astro:build:start': async ({ logger }) => {
        if (options.offline || process.env.OCTOPAGE_OFFLINE === '1') return;
        if (config.source !== 'code') return;

        const result = await pairDiscussions({
          root: siteRoot,
          config,
          trailingSlash,
          log: (m) => logger.info(m),
        });
        const created = result.filter((r) => r.created).length;
        logger.info(`Paired ${result.length} page(s) with discussions (${created} newly created).`);
      },
    },
  };
}

/**
 * The giscus settings that are identical for every page. Pages in
 * `discussions` mode add their own `data-term` (the discussion number); pages in
 * `code` mode need nothing further, since giscus derives the term from the URL.
 */
export function giscusBaseConfig(config: OctopageConfig): Omit<GiscusConfig, 'term'> | null {
  if (config.comments === false) return null;

  const repo = config.comments.repo ?? config.repo;

  return {
    repo: `${repo.owner}/${repo.name}`,
    repoId: config.comments.repoId,
    category: config.comments.category,
    categoryId: config.comments.categoryId,
    mapping: mappingForSource(config.source),
    strict: config.comments.strict,
    reactionsEnabled: config.comments.reactionsEnabled,
    inputPosition: config.comments.inputPosition,
    theme: config.comments.theme,
    lang: config.comments.lang,
  };
}

export { giscusAttributes };
