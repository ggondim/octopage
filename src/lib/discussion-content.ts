import type { OctopageConfig } from './config.ts';
import type { RestDiscussion } from './discussions-rest.ts';
import { normalizeRoute, slugify } from './routing.ts';

/**
 * Author associations whose discussions are published.
 *
 * This is the one defence that matters once bodies are compiled in the reader's
 * browser. `author_association` comes from GitHub's response, so a visitor
 * cannot forge it — which narrows the risk from "anyone with a GitHub account"
 * to "someone who already has write access to this repository", and they could
 * ship malicious JavaScript by pushing a commit anyway.
 */
const TRUSTED_AUTHORS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

/**
 * giscus embeds the SHA-1 of a thread's title in its body. It marks comment
 * threads — including ones the giscus bot opens on a reader's first comment —
 * which is how those are kept out of the content list.
 */
const GISCUS_MARKER = /<!--\s*sha1:\s*[0-9a-f]{40}\s*-->/i;

/** Frontmatter in an HTML comment, invisible in GitHub's editor and rendering. */
const LEADING_COMMENT = /^\s*<!--(?:\s*octopage)?\s*\r?\n([\s\S]*?)\r?\n\s*-->\s*/;

export interface DiscussionPost {
  number: number;
  title: string;
  description?: string;
  /** MDX source, frontmatter stripped. */
  body: string;
  route: string;
  slug: string;
  category: string;
  labels: string[];
  author: string | null;
  authorUrl: string | null;
  date: string;
  discussionUrl: string;
  comments: number;
}

/**
 * Parse the `key: value` lines of an HTML-comment frontmatter block.
 *
 * Deliberately not a YAML parser. This code runs in the reader's browser, and a
 * real one costs about 40 KB and pulls in Node's `Buffer` — for a block that in
 * practice holds a handful of scalars. Anything more elaborate than
 * `key: value`, `# comment` and a `[a, b]` list is ignored rather than
 * half-understood.
 */
function parseFields(block: string): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  for (const line of block.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf(':');
    if (separator < 1) continue;

    const key = trimmed.slice(0, separator).trim();
    let raw = trimmed.slice(separator + 1).trim();
    if (!key) continue;

    if (
      (raw.startsWith('"') && raw.endsWith('"') && raw.length > 1) ||
      (raw.startsWith("'") && raw.endsWith("'") && raw.length > 1)
    ) {
      raw = raw.slice(1, -1);
    }

    if (raw.startsWith('[') && raw.endsWith(']')) {
      data[key] = raw
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
      continue;
    }

    if (raw === 'true' || raw === 'false') {
      data[key] = raw === 'true';
      continue;
    }

    data[key] = raw;
  }

  return data;
}

function splitFrontmatter(body: string): { data: Record<string, unknown>; content: string } {
  const match = LEADING_COMMENT.exec(body);
  if (!match || GISCUS_MARKER.test(match[0])) return { data: {}, content: body };

  return { data: parseFields(match[1]), content: body.slice(match[0].length) };
}

/**
 * Turn the raw API response into the posts the site publishes.
 *
 * Pure and isomorphic: the same filtering runs wherever this is called, so what
 * a reader sees cannot drift from what a build-time listing would have shown.
 */
export function toPosts(discussions: RestDiscussion[], config: OctopageConfig): DiscussionPost[] {
  const categories = config.discussions.categories?.map((c) => c.toLowerCase());
  const wantedLabels = config.discussions.labels?.map((l) => l.toLowerCase());
  const draft = config.discussions.draftLabel.toLowerCase();

  const posts: DiscussionPost[] = [];

  for (const d of discussions) {
    if (!TRUSTED_AUTHORS.has(d.author_association)) continue;
    if (GISCUS_MARKER.test(d.body)) continue;

    const labels = d.labels.map((l) => l.name);
    const lower = labels.map((l) => l.toLowerCase());
    if (lower.includes(draft)) continue;
    if (categories && !categories.includes(d.category.name.toLowerCase())) continue;
    if (wantedLabels && !lower.some((l) => wantedLabels.includes(l))) continue;

    const { data, content } = splitFrontmatter(d.body);
    const slug = typeof data.slug === 'string' ? data.slug : String(d.number);

    const pinned = Object.entries(config.routes).find(
      ([, target]) => 'discussion' in target && target.discussion === d.number,
    );

    posts.push({
      number: d.number,
      title: typeof data.title === 'string' ? data.title : d.title,
      description: typeof data.description === 'string' ? data.description : undefined,
      body: content.trim(),
      route: pinned
        ? normalizeRoute(pinned[0])
        : normalizeRoute(`${config.discussions.basePath}/${slugify(d.category.name)}/${slug}`),
      slug,
      category: d.category.name,
      labels,
      author: d.user?.login ?? null,
      authorUrl: d.user?.html_url ?? null,
      date: d.created_at,
      discussionUrl: d.html_url,
      comments: d.comments,
    });
  }

  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

/** Match a post to a browser pathname, tolerating the base path and trailing slash. */
export function findByPathname(posts: DiscussionPost[], pathname: string, base: string): DiscussionPost | null {
  const prefix = base === '/' ? '' : `/${base.replace(/^\/|\/$/g, '')}`;
  const withoutBase = prefix && pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  const route = normalizeRoute(withoutBase || '/');
  return posts.find((p) => p.route === route) ?? null;
}
