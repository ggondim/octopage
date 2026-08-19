import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import matter from 'gray-matter';
import type { OctopageConfig } from '../config.ts';
import { parseCommentFrontmatter } from '../frontmatter.ts';
import { fetchDiscussions, type Discussion } from '../github/discussions.ts';
import { discussionRoute, pinnedDiscussionNumbers, slugifyCategory } from '../routing.ts';

/**
 * Directory the sync writes into. Generated, gitignored, and rebuilt from
 * scratch on every run: in `discussions` mode the repository's Discussions are
 * the source of truth, and a stale file left behind would republish a page the
 * author deleted on GitHub.
 */
export const SYNC_DIR = '.octopage/content';

export interface SyncOptions {
  /** Site root; `SYNC_DIR` is resolved against it. */
  root: string;
  config: OctopageConfig;
  token?: string;
  log?: (message: string) => void;
}

export interface SyncResult {
  written: number;
  skipped: number;
  files: string[];
}

/**
 * Pull discussions down into MDX files on disk.
 *
 * Writing real files, rather than feeding a custom Astro content loader, is the
 * deliberate choice here. `renderMarkdown()` in the Content Layer API renders
 * Markdown only — it has no MDX equivalent — so a loader-based path would lose
 * the component tags the author embedded in the discussion body. Going through
 * disk lets both source modes share one pipeline: the ordinary `glob()` loader
 * plus `@astrojs/mdx`, with islands, image optimization and component imports
 * all behaving identically whether the page came from a file or a discussion.
 */
export async function syncDiscussionsToMdx(options: SyncOptions): Promise<SyncResult> {
  const { root, config, token } = options;
  const log = options.log ?? (() => {});
  const outDir = join(root, SYNC_DIR);

  const wanted = new Set(config.discussions.contentCategories.map((c) => c.toLowerCase()));
  const pinned = pinnedDiscussionNumbers(config);

  log(`Fetching discussions from ${config.repo.owner}/${config.repo.name}…`);
  const all = await fetchDiscussions(config.repo.owner, config.repo.name, { token });

  const content = all.filter(
    (d) => wanted.has(d.category.name.toLowerCase()) || wanted.has(d.category.slug.toLowerCase()),
  );

  // Rebuild from empty so deletions and category moves propagate.
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const files: string[] = [];
  let skipped = 0;

  for (const discussion of content) {
    const labels = discussion.labels.map((l) => l.name);
    if (labels.some((l) => l.toLowerCase() === config.discussions.draftLabel.toLowerCase())) {
      skipped++;
      log(`  draft, skipping: #${discussion.number} ${discussion.title}`);
      continue;
    }

    const file = await writeDiscussion({ discussion, config, outDir, pinnedRoute: pinned.get(discussion.number) });
    files.push(file);
  }

  log(`Synced ${files.length} discussion(s), skipped ${skipped} draft(s).`);
  return { written: files.length, skipped, files };
}

interface WriteInput {
  discussion: Discussion;
  config: OctopageConfig;
  outDir: string;
  pinnedRoute?: string;
}

async function writeDiscussion({ discussion, config, outDir, pinnedRoute }: WriteInput): Promise<string> {
  const { data: userData, content } = parseCommentFrontmatter<Record<string, unknown>>(discussion.body);

  const slug = typeof userData.slug === 'string' ? userData.slug : undefined;
  const route = pinnedRoute ?? discussionRoute(config, discussion, slug);

  const frontmatter: Record<string, unknown> = {
    // Discussion metadata first, so author-supplied keys can override any of it.
    title: discussion.title,
    date: discussion.createdAt,
    updated: discussion.lastEditedAt ?? discussion.updatedAt,
    author: discussion.author?.login ?? null,
    authorUrl: discussion.author?.url ?? null,
    authorAvatar: discussion.author?.avatarUrl ?? null,
    category: discussion.category.name,
    categorySlug: slugifyCategory(discussion.category.name),
    labels: discussion.labels.map((l) => l.name),
    upvotes: discussion.upvoteCount,
    commentCount: discussion.comments.totalCount,
    ...userData,
    // Identity and routing are ours to decide — an author cannot repoint them
    // by writing `discussion:` in their frontmatter.
    discussion: discussion.number,
    discussionUrl: discussion.url,
    route,
    source: 'discussions',
  };

  const categoryDir = slugifyCategory(discussion.category.name);
  const filePath = join(outDir, categoryDir, `${slug ?? discussion.number}.mdx`);

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, matter.stringify(`\n${content.trim()}\n`, frontmatter), 'utf8');

  return filePath;
}
