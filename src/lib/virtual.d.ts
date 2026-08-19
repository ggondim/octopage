declare module 'octopage:config' {
  import type { OctopageConfig } from './config.ts';
  import type { GiscusConfig } from './giscus.ts';

  export const config: OctopageConfig;

  /** Site name and tagline, read from package.json at build time. */
  export const site: { title: string; description: string };

  /** `null` when comments could not be resolved (offline, or no usable category). */
  export const giscus: Omit<GiscusConfig, 'term' | 'mapping'> | null;

  export default config;
}
