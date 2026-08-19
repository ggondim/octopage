import type { AstroIntegration } from 'astro';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseConfig, type OctopageConfig, type OctopageUserConfig } from './config.ts';
import { giscusBaseConfig } from './giscus-config.ts';
import { redirectRoutes } from './routing.ts';

const VIRTUAL_ID = 'octopage:config';
const RESOLVED_VIRTUAL_ID = '\0octopage:config';

/**
 * The octopage Astro integration.
 *
 * It resolves what cannot be known statically — the repository, the giscus
 * category and ids — and hands the result to the site through a virtual module.
 * The site's own identity (`site`, `base`, `trailingSlash`) stays in
 * astro.config.mjs, where Astro already keeps it; restating it here would only
 * create a second place for it to be wrong.
 */
export default function octopage(userConfig: OctopageUserConfig = {}): AstroIntegration {
  const config: OctopageConfig = parseConfig(userConfig);

  return {
    name: 'octopage',
    hooks: {
      'astro:config:setup': async ({ updateConfig, logger, config: astroConfig }) => {
        const base = astroConfig.base ?? '/';
        const site = await readSiteIdentity(fileURLToPath(astroConfig.root));

        const redirects = redirectRoutes(config, base);
        if (Object.keys(redirects).length) updateConfig({ redirects });

        // Resolved once here rather than per page: it costs a round trip, and
        // every page needs the same answer.
        let giscus: Awaited<ReturnType<typeof giscusBaseConfig>> = null;
        try {
          giscus = await giscusBaseConfig(config);
        } catch (error) {
          logger.warn(`Comments disabled: ${(error as Error).message}`);
        }

        updateConfig({
          vite: {
            resolve: {
              // The ESM build imports its own stylesheets as side effects. Left
              // external, Node's SSR loader reaches those .css files directly
              // and fails with "Unknown file extension .css".
              noExternal: ['@primer/react-brand'],
              alias: [
                {
                  // @primer/react-brand's "." export is CJS; the ESM build sits
                  // behind "./esm". Astro's SSR pass imports it as ESM, where
                  // named imports off the CJS barrel fail. Anchored on both ends
                  // so the stylesheet and font subpaths are left alone.
                  find: /^@primer\/react-brand$/,
                  replacement: '@primer/react-brand/esm',
                },
              ],
            },
            plugins: [
              {
                name: 'octopage:virtual-config',
                resolveId: (id: string) => (id === VIRTUAL_ID ? RESOLVED_VIRTUAL_ID : null),
                load: (id: string) =>
                  id === RESOLVED_VIRTUAL_ID
                    ? [
                        `export const config = ${JSON.stringify(config)};`,
                        `export const site = ${JSON.stringify(site)};`,
                        `export const giscus = ${JSON.stringify(giscus)};`,
                        `export default config;`,
                      ].join('\n')
                    : null,
              },
            ],
          },
        });
      },
    },
  };
}

export interface SiteIdentity {
  title: string;
  description: string;
}

/**
 * The site's name and tagline, read from package.json.
 *
 * Astro's own config carries `site` and `base` — the URL the site lives at —
 * but has no notion of a title, and package.json already has to name the
 * project. Taking it from there keeps a single place to rename the site.
 */
async function readSiteIdentity(root: string): Promise<SiteIdentity> {
  try {
    const pkg = JSON.parse(await readFile(new URL('package.json', `file://${root}/`), 'utf8'));
    return {
      title: typeof pkg.name === 'string' ? pkg.name : 'octopage',
      description: typeof pkg.description === 'string' ? pkg.description : '',
    };
  } catch {
    return { title: 'octopage', description: '' };
  }
}
