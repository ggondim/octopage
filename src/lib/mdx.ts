import { evaluate } from '@mdx-js/mdx';
import * as runtime from 'react/jsx-runtime';
import type { ComponentType } from 'react';

/**
 * Compile an MDX string into a component, in memory, at build time.
 *
 * This is what lets discussion bodies stay a live read of the GitHub API rather
 * than something synced onto disk first. Astro's Content Layer can fetch remote
 * content, but its `renderMarkdown()` helper is Markdown-only — there is no MDX
 * equivalent — so a discussion body containing component tags would lose them.
 * Compiling here keeps the API the single source of truth: nothing about a page
 * exists locally between builds.
 *
 * The output is rendered, never hydrated, so the compiled code stays on the
 * build machine and costs the reader nothing.
 */
/**
 * Import statements are rejected rather than resolved.
 *
 * A discussion in a public repository can be opened by anyone with a GitHub
 * account, so its body is untrusted input that this build compiles and runs.
 * Allowing `import` would turn that into arbitrary module loading on the build
 * machine. Components come from a fixed scope instead, which also makes bodies
 * nicer to write: no import line to remember in the GitHub editor.
 */
const IMPORT_STATEMENT = /^\s*import\s.+?from\s+['"][^'"]+['"]/m;

export class UnsafeContentError extends Error {}

export async function compileMdx(source: string): Promise<ComponentType<{ components?: Record<string, unknown> }>> {
  if (IMPORT_STATEMENT.test(source)) {
    throw new UnsafeContentError(
      'A discussion body contains an `import` statement. Components are provided automatically — ' +
        'use <Label> directly, without importing it.',
    );
  }

  const { default: Content } = await evaluate(source, {
    ...(runtime as Record<string, unknown>),
    baseUrl: import.meta.url,
    development: false,
  } as never);

  return Content as ComponentType<{ components?: Record<string, unknown> }>;
}

/**
 * Frontmatter carried inside an HTML comment.
 *
 * GitHub's discussion editor renders Markdown, so a `---` fence would show up
 * as a horizontal rule followed by visible `key: value` lines. An HTML comment
 * is invisible both in the editor and in the rendered discussion, which lets a
 * discussion double as a page without looking broken to anyone reading it on
 * GitHub.
 *
 *   <!-- octopage
 *   description: Hello
 *   -->
 */
const LEADING_COMMENT = /^\s*<!--(?:\s*octopage)?\s*\r?\n([\s\S]*?)\r?\n\s*-->\s*/;

/**
 * giscus embeds the SHA-1 of a thread's title in its body and searches for that
 * instead of matching title text. It marks comment threads — including ones the
 * giscus bot creates on a reader's first comment — which is how those are told
 * apart from discussions meant to be published as pages.
 */
export const GISCUS_MARKER = /<!--\s*sha1:\s*[0-9a-f]{40}\s*-->/i;

export function isCommentThread(body: string): boolean {
  return GISCUS_MARKER.test(body);
}

export interface ParsedBody {
  data: Record<string, unknown>;
  content: string;
}

export function parseCommentFrontmatter(body: string, matter: (s: string) => { data: unknown }): ParsedBody {
  const match = LEADING_COMMENT.exec(body);
  if (!match || GISCUS_MARKER.test(match[0])) return { data: {}, content: body };

  const parsed = matter(`---\n${match[1]}\n---\n`);
  return { data: (parsed.data ?? {}) as Record<string, unknown>, content: body.slice(match[0].length) };
}
