declare module 'octopage:config' {
  import type { OctopageConfig } from './config.ts';
  import type { RepoRef } from './discussions-rest.ts';

  export const config: OctopageConfig;

  /** Site name and tagline, read from package.json at build time. */
  export const site: { title: string; description: string };

  /** Derived from the git remote, or GITHUB_REPOSITORY in Actions. */
  export const repo: RepoRef;

  /**
   * giscus `data-*` attributes, without `data-mapping` — that belongs to the
   * page. `null` when comments could not be resolved.
   */
  export const giscus: Record<string, string> | null;

  export default config;
}
