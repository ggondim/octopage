/**
 * Types for the `octopage:config` virtual module the integration injects.
 *
 * Reference it from a site with:
 *   /// <reference types="octopage/virtual" />
 */
declare module 'octopage:config' {
  import type { OctopageConfig } from 'octopage/config';
  import type { GiscusConfig } from 'octopage';

  export const config: OctopageConfig;

  /** `null` when `comments: false`. */
  export const giscus: Omit<GiscusConfig, 'term'> | null;

  export default config;
}
