import type { OctopageConfig } from './config.ts';
import { resolveCommentsCategory, type GiscusConfig } from './giscus.ts';
import { fetchRepositoryInfo } from './github/discussions.ts';
import { resolveRepo } from './repo.ts';

/**
 * The giscus settings shared by every page.
 *
 * `repoId` and `categoryId` are opaque node ids that only the API can produce,
 * which is why this needs a network round trip rather than being derivable from
 * the repo name alone.
 */
export async function giscusBaseConfig(config: OctopageConfig): Promise<Omit<GiscusConfig, 'term' | 'mapping'> | null> {
  if (process.env.OCTOPAGE_OFFLINE === '1') return null;

  const repo = resolveRepo();
  const info = await fetchRepositoryInfo(repo.owner, repo.name);

  if (!info.hasDiscussionsEnabled) {
    throw new Error(
      `Discussions are not enabled on ${repo.owner}/${repo.name}. ` +
        'Turn them on under Settings → General → Features.',
    );
  }

  const category = resolveCommentsCategory(info.categories, config.comments);

  return {
    repo: `${repo.owner}/${repo.name}`,
    repoId: info.id,
    category: category.name,
    categoryId: category.id,
    strict: true,
  };
}
