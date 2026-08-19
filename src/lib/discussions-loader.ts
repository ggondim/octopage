import type { Loader } from 'astro/loaders';
import matter from 'gray-matter';
import type { OctopageConfig } from './config.ts';
import { isCommentThread, parseCommentFrontmatter } from './mdx.ts';
import { fetchDiscussions } from './github/discussions.ts';
import { resolveRepo } from './repo.ts';
import { slugify } from './routing.ts';

/**
 * Content Layer loader for GitHub Discussions.
 *
 * It stores data only — including the raw body — and never writes a file. The
 * body is compiled to a component at render time by `compileMdx`, so the
 * repository's Discussions stay the single source of truth: edit one on GitHub,
 * rebuild, and the page changes, with nothing stale on disk in between.
 */
/**
 * Author associations whose discussions are published.
 *
 * GitHub reports this per discussion, and these three are the ones that already
 * have write access to the repository — the same people who could change the
 * site by pushing to it.
 */
const TRUSTED_AUTHORS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

export function discussionsLoader(config: OctopageConfig): Loader {
  return {
    name: 'octopage-discussions',

    async load({ store, logger, parseData, generateDigest }) {
      if (process.env.OCTOPAGE_OFFLINE === '1') {
        logger.warn('OCTOPAGE_OFFLINE=1 — skipping the Discussions fetch.');
        return;
      }

      const repo = resolveRepo();
      const all = await fetchDiscussions(repo.owner, repo.name);

      store.clear();

      const categories = config.discussions.categories?.map((c) => c.toLowerCase());
      const labels = config.discussions.labels?.map((l) => l.toLowerCase());
      const draft = config.discussions.draftLabel.toLowerCase();

      let skipped = 0;

      for (const discussion of all) {
        // Anyone with a GitHub account can open a discussion in a public
        // repository, and this build compiles discussion bodies as MDX — which
        // evaluates JavaScript expressions. Publishing only what a trusted
        // author wrote is the difference between "the repo is the CMS" and
        // "any passer-by can run code in CI". Narrow this with
        // `discussions.labels` if a review-then-label workflow suits better.
        if (!TRUSTED_AUTHORS.has(discussion.authorAssociation)) {
          skipped++;
          continue;
        }

        const names = discussion.labels.map((l) => l.name.toLowerCase());

        // A comment thread is not a page. giscus marks the threads it creates,
        // and octopage marks the ones it creates, so this holds without the
        // author having to keep content and comments in separate categories.
        if (isCommentThread(discussion.body)) {
          skipped++;
          continue;
        }
        if (names.includes(draft)) {
          skipped++;
          continue;
        }
        if (categories && !categories.includes(discussion.category.name.toLowerCase())) continue;
        if (labels && !names.some((n) => labels.includes(n))) continue;

        const { data: front, content } = parseCommentFrontmatter(discussion.body, (s) => matter(s));

        const slug = typeof front.slug === 'string' ? front.slug : String(discussion.number);
        const id = `${slugify(discussion.category.name)}/${slug}`;

        const data = await parseData({
          id,
          data: {
            title: discussion.title,
            date: discussion.createdAt,
            updated: discussion.lastEditedAt ?? discussion.updatedAt,
            author: discussion.author?.login ?? null,
            authorUrl: discussion.author?.url ?? null,
            authorAvatar: discussion.author?.avatarUrl ?? null,
            category: discussion.category.name,
            labels: discussion.labels.map((l) => l.name),
            upvotes: discussion.upvoteCount,
            discussion: discussion.number,
            discussionUrl: discussion.url,
            ...front,
            // The body travels as data because there is no file to render from.
            body: content.trim(),
            slug,
          },
        });

        store.set({ id, data, digest: generateDigest(data) });
      }

      logger.info(`${store.keys().length} discussion(s) published, ${skipped} skipped.`);
    },
  };
}
