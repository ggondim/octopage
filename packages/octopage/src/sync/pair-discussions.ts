import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import type { OctopageConfig } from '../config.ts';
import { parseFileFrontmatter } from '../frontmatter.ts';
import { giscusPathnameTerm } from '../giscus.ts';
import { ensureDiscussionForTerm } from '../github/create-discussion.ts';
import { fetchRepositoryInfo } from '../github/discussions.ts';
import { normalizeRoute } from '../routing.ts';

export interface ContentFile {
  /** Absolute path on disk. */
  path: string;
  /** Route the page will be served at, without base or trailing slash. */
  route: string;
  /** The exact term giscus will search for in the browser. */
  term: string;
  frontmatter: Record<string, unknown>;
}

/**
 * URL pathname a route is actually served at, including the deploy base and the
 * trailing slash Astro's default directory build format produces.
 *
 * Both details matter more than they look: giscus derives its search term from
 * `location.pathname` verbatim, so a site deployed under `/octopage` pairs on
 * `octopage/blog/post/`, not `blog/post`. Computing the term from the route
 * alone is the single easiest way to end up with every page showing an empty
 * comment box.
 */
export function servedPathname(route: string, base: string, trailingSlash: boolean): string {
  const cleanBase = base === '/' ? '' : `/${base.replace(/^\/|\/$/g, '')}`;
  const cleanRoute = route === '/' ? '' : route;
  const path = `${cleanBase}${cleanRoute}` || '/';
  if (path === '/') return '/';
  return trailingSlash ? `${path}/` : path;
}

/**
 * Route for a content file, from its position on disk.
 *
 * A directory named `pages` maps to the site root, matching Astro's own
 * `src/pages` convention; every other directory keeps its name as the prefix.
 * `index.mdx` collapses to its parent directory.
 */
export function routeForFile(relPath: string, dir: string): string {
  const withoutExt = relPath.slice(0, relPath.length - extname(relPath).length);
  const segments = withoutExt.split(sep).filter(Boolean);

  if (segments.at(-1) === 'index') segments.pop();

  const prefix = dir === 'pages' ? [] : [dir];
  return normalizeRoute([...prefix, ...segments].join('/'));
}

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // A configured content dir that does not exist yet is not an error.
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.name.endsWith('.mdx') || entry.name.endsWith('.md')) yield full;
  }
}

/** Enumerate the content files of a `code`-mode site, with routes and terms resolved. */
export async function collectContentFiles(
  root: string,
  config: OctopageConfig,
  opts: { trailingSlash?: boolean } = {},
): Promise<ContentFile[]> {
  const trailingSlash = opts.trailingSlash ?? true;
  const files: ContentFile[] = [];

  for (const dir of config.code.dirs) {
    const absDir = join(root, dir);
    for await (const path of walk(absDir)) {
      const source = await readFile(path, 'utf8');
      const { data } = parseFileFrontmatter(source);
      const route = typeof data.route === 'string' ? normalizeRoute(data.route) : routeForFile(relative(absDir, path), dir);

      files.push({
        path,
        route,
        term: giscusPathnameTerm(servedPathname(route, config.site.base, trailingSlash)),
        frontmatter: data,
      });
    }
  }

  return files;
}

export interface PairResult {
  route: string;
  term: string;
  number: number;
  url: string;
  created: boolean;
}

/**
 * Ensure every `code`-mode page has the discussion giscus will pair with.
 *
 * Runs at build time, before Astro. Idempotent — see `ensureDiscussionForTerm`,
 * which looks the discussion up the same way giscus does before creating one.
 */
export async function pairDiscussions(options: {
  root: string;
  config: OctopageConfig;
  token?: string;
  trailingSlash?: boolean;
  log?: (message: string) => void;
}): Promise<PairResult[]> {
  const { root, config, token } = options;
  const log = options.log ?? (() => {});

  if (config.comments === false) {
    log('Comments are disabled — nothing to pair.');
    return [];
  }
  if (!config.code.createDiscussions) {
    log('code.createDiscussions is false — skipping discussion creation.');
    return [];
  }

  const commentsRepo = config.comments.repo ?? config.repo;
  const info = await fetchRepositoryInfo(commentsRepo.owner, commentsRepo.name, { token });

  if (!info.hasDiscussionsEnabled) {
    throw new Error(
      `Discussions are not enabled on ${commentsRepo.owner}/${commentsRepo.name}. ` +
        `Enable them under Settings → General → Features before building.`,
    );
  }

  const files = await collectContentFiles(root, config, { trailingSlash: options.trailingSlash });
  const results: PairResult[] = [];

  for (const file of files) {
    const labels = Array.isArray(file.frontmatter.labels)
      ? (file.frontmatter.labels as unknown[]).filter((l): l is string => typeof l === 'string')
      : [];

    const { discussion, created } = await ensureDiscussionForTerm(
      {
        owner: commentsRepo.owner,
        name: commentsRepo.name,
        repositoryId: info.id,
        categoryId: config.comments.categoryId,
        term: file.term,
        pageUrl: new URL(servedPathname(file.route, config.site.base, options.trailingSlash ?? true), config.site.url).href,
        labels,
        intro: typeof file.frontmatter.title === 'string' ? `### ${file.frontmatter.title}` : undefined,
      },
      { token },
    );

    log(`  ${created ? 'created' : 'found'} #${discussion.number} for ${file.term}`);
    results.push({ route: file.route, term: file.term, number: discussion.number, url: discussion.url, created });
  }

  return results;
}
