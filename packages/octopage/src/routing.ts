import type { OctopageConfig, RouteTarget } from './config.ts';

/** Trim to a single leading slash and no trailing slash (except for the root). */
export function normalizeRoute(route: string): string {
  const trimmed = `/${route}`.replace(/\/+/g, '/').replace(/\/$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/** `Some Category` -> `some-category`. Mirrors GitHub's own category slugs. */
export function slugifyCategory(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function slugify(value: string): string {
  return slugifyCategory(value);
}

/**
 * Default route for a discussion-backed page: `/content/[category]/[id]`.
 *
 * `id` is the discussion number unless frontmatter supplies a `slug`. Numbers
 * are stable and collision-free, which matters because a discussion title can
 * change at any moment without anything rebuilding.
 */
export function discussionRoute(
  config: OctopageConfig,
  discussion: { number: number; category: { name: string } },
  slug?: string,
): string {
  const base = normalizeRoute(config.discussions.basePath);
  const category = slugifyCategory(discussion.category.name);
  return normalizeRoute(`${base}/${category}/${slug ?? discussion.number}`);
}

export interface ResolvedRoute {
  route: string;
  target: RouteTarget;
}

/**
 * The custom URL tree, normalized.
 *
 * These take precedence over generated routes: an author who pins `/about` to
 * discussion 12 means it, even if discussion 12 would otherwise have landed at
 * `/content/general/12`.
 */
export function resolveCustomRoutes(config: OctopageConfig): ResolvedRoute[] {
  return Object.entries(config.routes).map(([route, target]) => ({
    route: normalizeRoute(route),
    target,
  }));
}

/**
 * Build a lookup from discussion number to the custom route claiming it, so the
 * generator can skip emitting the default route for a pinned discussion instead
 * of publishing the same content at two URLs.
 */
export function pinnedDiscussionNumbers(config: OctopageConfig): Map<number, string> {
  const map = new Map<number, string>();
  for (const { route, target } of resolveCustomRoutes(config)) {
    if ('discussion' in target) map.set(target.discussion, route);
  }
  return map;
}

/**
 * Route for a collection entry, in either source mode.
 *
 * `discussions` mode writes an explicit `route` into frontmatter during sync,
 * so it wins outright. `code` mode derives the route from the entry id, which
 * the glob loader sets to the extension-less path relative to the site root —
 * `blog/my-post`, `pages/about`. A leading `pages/` segment collapses to the
 * root, matching Astro's own `src/pages` convention, and a trailing `index`
 * collapses to its parent.
 */
export function routeForEntry(
  entry: { id: string; data: { route?: string; slug?: string } },
  pagesDir = 'pages',
): string {
  if (entry.data.route) return normalizeRoute(entry.data.route);

  const segments = entry.id.split('/').filter(Boolean);
  if (segments[0] === pagesDir) segments.shift();
  if (segments.at(-1) === 'index') segments.pop();

  return normalizeRoute(segments.join('/'));
}

/** Split a route into the `[...slug]` param Astro expects (`undefined` at root). */
export function routeToSlugParam(route: string): string | undefined {
  const slug = route.replace(/^\//, '');
  return slug === '' ? undefined : slug;
}

export interface RoutableEntry {
  id: string;
  data: { route?: string; slug?: string; discussion?: number };
}

/**
 * The final route for an entry, custom URL tree included.
 *
 * Precedence, highest first:
 *   1. a `routes` entry pinning this discussion number or this entry id
 *   2. an explicit `route` in frontmatter (which is also how the discussions
 *      sync propagates a pin it already resolved)
 *   3. the path on disk
 *
 * Pins win outright: an author who points `/about` at discussion 12 means it,
 * and the page must not also be published at `/content/general/12`.
 */
export function resolveEntryRoute(entry: RoutableEntry, config: OctopageConfig, pagesDir = 'pages'): string {
  for (const { route, target } of resolveCustomRoutes(config)) {
    if ('discussion' in target && entry.data.discussion === target.discussion) return route;
    if ('entry' in target && entry.id === target.entry) return route;
  }
  return routeForEntry(entry, pagesDir);
}

/**
 * `routes` members that are plain redirects, in the shape Astro's `redirects`
 * config option takes. Emitting them through Astro rather than hand-rolling
 * meta-refresh pages means each host applies its own native redirect mechanism.
 */
export function redirectRoutes(config: OctopageConfig): Record<string, string> {
  const base = config.site.base === '/' ? '' : `/${config.site.base.replace(/^\/|\/$/g, '')}`;
  const redirects: Record<string, string> = {};

  for (const { route, target } of resolveCustomRoutes(config)) {
    if (!('redirect' in target)) continue;

    // Astro applies `base` to the redirect *source* but emits the destination
    // verbatim, so an internal target has to carry the base itself or the
    // redirect lands on a 404 the moment the site is deployed to a project
    // page. Absolute URLs are left alone.
    const isExternal = /^[a-z][a-z0-9+.-]*:/i.test(target.redirect) || target.redirect.startsWith('//');
    redirects[route] = isExternal ? target.redirect : `${base}${normalizeRoute(target.redirect)}`;
  }

  return redirects;
}
