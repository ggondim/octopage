/**
 * Giscus pairing.
 *
 * The term giscus searches for is computed *client-side*, in the browser, by
 * giscus's own `client.ts`. Anything we generate at build time — most
 * importantly the title of the discussion we create in `code` mode — has to
 * agree with that computation exactly, or the page silently renders an empty
 * comment box and a "create the discussion" prompt instead of the thread.
 *
 * Mirrored from giscus/client.ts:
 *
 *   case 'number':   params.number = attributes.term
 *   case 'pathname': params.term = location.pathname.length < 2
 *                      ? 'index'
 *                      : location.pathname.substring(1).replace(/\.\w+$/, '')
 *
 * Note what `pathname` does and does not strip: it drops the *leading* slash
 * and a trailing file extension, but it keeps a trailing slash. So with Astro's
 * default `trailingSlash: 'ignore'` emitting directory URLs, `/blog/post/`
 * yields the term `blog/post/`, not `blog/post`. Deriving the title from the
 * route ourselves would reintroduce exactly that mismatch, so we run the same
 * function over the same pathname instead.
 */

/** Values giscus accepts for `data-mapping`. */
export type GiscusMapping = 'pathname' | 'url' | 'title' | 'og:title' | 'specific' | 'number';

export type GiscusInputPosition = 'top' | 'bottom';

/**
 * Compute the discussion term giscus will search for on a page served at
 * `pathname`, under `mapping: 'pathname'`.
 *
 * @param pathname A URL pathname, with leading slash (e.g. `/blog/post/`).
 */
export function giscusPathnameTerm(pathname: string): string {
  return pathname.length < 2 ? 'index' : pathname.substring(1).replace(/\.\w+$/, '');
}

export interface GiscusConfig {
  /**
   * `owner/name`. A plain string rather than a template-literal type: this
   * value round-trips through JSON in the virtual module, which erases the
   * narrowing anyway, and the stricter type only produced casts at every call
   * site without catching anything real.
   */
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
  mapping: GiscusMapping;
  /** Carries the discussion number under `number`, or the literal term under `specific`. */
  term?: string;
  strict?: boolean;
  reactionsEnabled?: boolean;
  emitMetadata?: boolean;
  inputPosition?: GiscusInputPosition;
  theme?: string;
  lang?: string;
  loading?: 'lazy' | 'eager';
}

/**
 * Render the `data-*` attribute set for the giscus `<script>` tag.
 *
 * Booleans become giscus's `'1'`/`'0'` rather than `'true'`/`'false'` — its
 * client compares against the string `'1'`.
 */
export function giscusAttributes(config: GiscusConfig): Record<string, string> {
  const attrs: Record<string, string> = {
    'data-repo': config.repo,
    'data-repo-id': config.repoId,
    'data-category': config.category,
    'data-category-id': config.categoryId,
    'data-mapping': config.mapping,
    'data-strict': config.strict ? '1' : '0',
    'data-reactions-enabled': config.reactionsEnabled === false ? '0' : '1',
    'data-emit-metadata': config.emitMetadata ? '1' : '0',
    'data-input-position': config.inputPosition ?? 'bottom',
    'data-theme': config.theme ?? 'preferred_color_scheme',
    'data-lang': config.lang ?? 'en',
    'data-loading': config.loading ?? 'lazy',
  };

  // `number` and `specific` both travel in data-term; the client routes it to
  // params.number or params.term based on the mapping.
  if (config.term !== undefined) attrs['data-term'] = config.term;

  return attrs;
}
