import matter from 'gray-matter';

/**
 * Frontmatter carried inside an HTML comment.
 *
 * GitHub's discussion editor renders Markdown, so a normal `---` fence would
 * show up as a horizontal rule followed by visible `key: value` lines. An HTML
 * comment is invisible in both the editor preview and the rendered discussion,
 * which lets a discussion double as a page without looking broken to anyone
 * reading it on GitHub.
 *
 * Recognised at the very start of the body, optionally tagged:
 *
 *   <!-- octopage
 *   title: Hello
 *   date: 2026-01-30
 *   -->
 *
 * The `octopage` tag is optional but recommended: without it, any leading HTML
 * comment gets parsed as YAML, which silently swallows a comment someone wrote
 * for a different reason.
 */
const LEADING_COMMENT = /^\s*<!--(?:\s*octopage)?\s*\r?\n([\s\S]*?)\r?\n\s*-->\s*/;

/**
 * giscus's strict mode embeds the SHA-1 of the discussion title in the body and
 * searches for that instead of the title text. We must not mistake it for
 * frontmatter, and must not strip it from bodies we round-trip.
 */
const GISCUS_SHA_COMMENT = /<!--\s*sha1:\s*[0-9a-f]{40}\s*-->/i;

export interface ParsedBody<T = Record<string, unknown>> {
  data: T;
  content: string;
}

/**
 * Split a discussion body into its HTML-comment frontmatter and its MDX.
 *
 * Falls back to `{ data: {}, content: body }` when no frontmatter block is
 * present — an un-annotated discussion is still a valid page, it just relies
 * entirely on its title, labels and category for metadata.
 */
export function parseCommentFrontmatter<T = Record<string, unknown>>(body: string): ParsedBody<T> {
  const match = LEADING_COMMENT.exec(body);
  if (!match) return { data: {} as T, content: body };

  // A leading giscus hash is not frontmatter.
  if (GISCUS_SHA_COMMENT.test(match[0])) return { data: {} as T, content: body };

  const yaml = match[1];
  const rest = body.slice(match[0].length);

  // Reuse gray-matter's YAML engine by handing it a conventional block, so the
  // type coercion here matches the one applied to `.mdx` files in code mode.
  const parsed = matter(`---\n${yaml}\n---\n`);

  return { data: parsed.data as T, content: rest };
}

/** Serialize data back into an HTML-comment block, for discussions we create. */
export function stringifyCommentFrontmatter(data: Record<string, unknown>, content: string): string {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return content;

  const yaml = matter.stringify('', data).replace(/^---\r?\n/, '').replace(/---\r?\n?$/, '').trimEnd();

  return `<!-- octopage\n${yaml}\n-->\n\n${content}`;
}

/** Standard `---` frontmatter, for `.mdx` files in code mode. */
export function parseFileFrontmatter<T = Record<string, unknown>>(source: string): ParsedBody<T> {
  const parsed = matter(source);
  return { data: parsed.data as T, content: parsed.content };
}
