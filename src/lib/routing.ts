import type { OctopageConfig, RouteTarget } from './config.ts';

/** Trim to a single leading slash and no trailing slash (except for the root). */
export function normalizeRoute(route: string): string {
  const trimmed = `/${route}`.replace(/\/+/g, '/').replace(/\/$/, '');
  return trimmed === '' ? '/' : trimmed;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface RoutableEntry {
  id: string;
  collection: 'pages' | 'discussions';
  data: { route?: string; slug?: string; discussion?: number };
}

export interface ResolvedRoute {
  route: string;
  target: RouteTarget;
}

export function customRoutes(config: OctopageConfig): ResolvedRoute[] {
  return Object.entries(config.routes).map(([route, target]) => ({ route: normalizeRoute(route), target }));
}

/**
 * The route an entry is served at.
 *
 * Precedence, highest first:
 *   1. a `routes` entry pinning this discussion number or this entry id
 *   2. an explicit `route` in frontmatter
 *   3. the entry's position — its path on disk, or its category and slug
 *
 * A pin wins outright and the derived route is not also published. Serving one
 * page at two URLs would split its comment thread, because giscus pairs
 * committed pages on the pathname.
 */
export function routeFor(entry: RoutableEntry, config: OctopageConfig): string {
  for (const { route, target } of customRoutes(config)) {
    if ('discussion' in target && entry.data.discussion === target.discussion) return route;
    if ('entry' in target && (entry.id === target.entry || `${entry.collection}/${entry.id}` === target.entry)) {
      return route;
    }
  }

  if (entry.data.route) return normalizeRoute(entry.data.route);

  if (entry.collection === 'discussions') {
    return normalizeRoute(`${config.discussions.basePath}/${entry.id}`);
  }

  // Committed content. A `pages/` directory maps to the site root, matching
  // Astro's own `src/pages` convention; every other directory keeps its name.
  const segments = entry.id.split('/').filter(Boolean);
  if (segments[0] === 'pages') segments.shift();
  if (segments.at(-1) === 'index') segments.pop();
  return normalizeRoute(segments.join('/'));
}

/** Split a route into the `[...slug]` param Astro expects (`undefined` at root). */
export function routeToSlugParam(route: string): string | undefined {
  const slug = route.replace(/^\//, '');
  return slug === '' ? undefined : slug;
}

/**
 * `routes` members that are plain redirects, in the shape Astro's `redirects`
 * option takes, with the deploy base prepended.
 *
 * Astro applies `base` to a redirect's source but emits its destination
 * verbatim, so an internal target has to carry the base itself or the redirect
 * lands on a 404 the moment the site is deployed to a project page.
 */
export function redirectRoutes(config: OctopageConfig, base: string): Record<string, string> {
  const prefix = base === '/' ? '' : `/${base.replace(/^\/|\/$/g, '')}`;
  const redirects: Record<string, string> = {};

  for (const { route, target } of customRoutes(config)) {
    if (!('redirect' in target)) continue;
    const external = /^[a-z][a-z0-9+.-]*:/i.test(target.redirect) || target.redirect.startsWith('//');
    redirects[route] = external ? target.redirect : `${prefix}${normalizeRoute(target.redirect)}`;
  }

  return redirects;
}
