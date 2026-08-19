import type { OctopageConfig } from './config.ts';
import { giscusAttributes } from './giscus.ts';
import { categoriesFrom, fetchDiscussions, fetchRepoId, type RepoRef } from './discussions-rest.ts';

/**
 * Resolve the giscus attributes shared by every page.
 *
 * Runs at build time and needs no token: `repo_id` is the repository's
 * `node_id` from the public REST endpoint, and each discussion carries its
 * category's node id, so both ids are reachable anonymously.
 *
 * The `mapping` is left out here on purpose — it belongs to the page, not the
 * site. A committed page pairs on `pathname`; a discussion-backed page pairs on
 * `number` and adds its own `data-term` once the fetch resolves.
 */
export async function resolveGiscus(
  repo: RepoRef,
  config: OctopageConfig,
): Promise<Record<string, string> | null> {
  if (process.env.OCTOPAGE_OFFLINE === '1') return null;

  const { id, hasDiscussions } = await fetchRepoId(repo);
  if (!hasDiscussions) {
    throw new Error(
      `Discussions are not enabled on ${repo.owner}/${repo.name}. ` +
        'Turn them on under Settings → General → Features.',
    );
  }

  const categories = categoriesFrom(await fetchDiscussions(repo));
  if (categories.length === 0) {
    throw new Error(
      'No discussion categories are visible yet. REST exposes categories only through the ' +
        'discussions that use them, so open one discussion (in the category comments should ' +
        'live in) and build again.',
    );
  }

  const wanted = config.comments;
  const category = wanted
    ? categories.find((c) => c.name.toLowerCase() === wanted.toLowerCase())
    : (categories.find((c) => c.name.toLowerCase() === 'announcements') ??
       categories.find((c) => !c.is_answerable));

  if (!category) {
    throw new Error(
      wanted
        ? `octopage.config.ts sets comments: '${wanted}', but no discussion uses a category by that name.\n` +
          `Visible: ${categories.map((c) => c.name).join(', ')}`
        : 'No usable category for comments. Set `comments` in octopage.config.ts.',
    );
  }

  // `mapping` is a required field on the type but is replaced per page; the
  // placeholder never reaches the DOM.
  const attrs = giscusAttributes({
    repo: `${repo.owner}/${repo.name}`,
    repoId: id,
    category: category.name,
    categoryId: category.node_id,
    mapping: 'pathname',
    strict: true,
  });

  return attrs;
}
