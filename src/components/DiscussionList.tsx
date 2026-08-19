import { useEffect, useState } from 'react';
import { Text } from '@primer/react-brand';
import { fetchDiscussionsCached, RateLimitError, type RepoRef } from '../lib/discussions-rest.ts';
import { toPosts, type DiscussionPost } from '../lib/discussion-content.ts';
import type { OctopageConfig } from '../lib/config.ts';
import { PostList } from './PostList.tsx';

/**
 * The discussion half of an index, filled in the browser.
 *
 * Renders nothing at all when there are no discussions or the fetch fails —
 * an index that silently lists less is better than one showing an error box
 * where posts should be, and the committed half above it is already in the HTML.
 */
export function DiscussionList({ repo, config, base }: { repo: RepoRef; config: OctopageConfig; base: string }) {
  const [posts, setPosts] = useState<DiscussionPost[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const found = toPosts(await fetchDiscussionsCached(repo), config);
        if (!cancelled) setPosts(found);
      } catch (error) {
        if (!cancelled) setNote(error instanceof RateLimitError ? error.message : null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [repo.owner, repo.name]);

  if (note) return <Text as="p" size="200" variant="muted">{note}</Text>;
  if (!posts?.length) return null;

  const prefix = base.replace(/\/$/, '');

  return (
    <PostList
      posts={posts.map((post) => ({
        title: post.title,
        description: post.description,
        href: `${prefix}${post.route}/`,
        category: post.category,
      }))}
    />
  );
}

export default DiscussionList;
