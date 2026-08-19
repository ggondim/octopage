import { useEffect, useState } from 'react';
import { Heading, Label, Stack, Text } from '@primer/react-brand';
import { evaluate } from '@mdx-js/mdx';
import * as runtime from 'react/jsx-runtime';
import type { ComponentType } from 'react';
import {
  fetchDiscussionsCached,
  RateLimitError,
  type RepoRef,
} from '../lib/discussions-rest.ts';
import { findByPathname, toPosts, type DiscussionPost } from '../lib/discussion-content.ts';
import type { OctopageConfig } from '../lib/config.ts';
import { discussionScope } from './mdx.tsx';
import { PostMeta } from './PostList.tsx';
import Comments from './GiscusWidget.tsx';

export interface DiscussionPageProps {
  repo: RepoRef;
  config: OctopageConfig;
  base: string;
  giscus: Record<string, string> | null;
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; post: DiscussionPost; Body: ComponentType<{ components?: Record<string, unknown> }> }
  | { status: 'missing' }
  | { status: 'error'; message: string };

/**
 * A discussion-backed page, resolved in the browser.
 *
 * Nothing about this page is built. The reader lands here, the component reads
 * the repository's Discussions from the anonymous REST API, finds the one whose
 * route matches the URL, compiles its body and renders it. Publishing is
 * therefore instant: open a discussion on GitHub and it is live, with no CI run
 * in between.
 *
 * The cost is that this content is not in the initial HTML, so search engines
 * that do not execute JavaScript will not see it. Committed `.mdx` is still
 * prerendered precisely so the site is not wholly dependent on that.
 */
export function DiscussionPage({ repo, config, base, giscus }: DiscussionPageProps) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const discussions = await fetchDiscussionsCached(repo);
        const post = findByPathname(toPosts(discussions, config), location.pathname, base);

        if (!post) {
          if (!cancelled) setState({ status: 'missing' });
          return;
        }

        const { default: Body } = await evaluate(post.body, {
          ...(runtime as Record<string, unknown>),
          baseUrl: location.href,
          development: false,
        } as never);

        if (!cancelled) {
          setState({ status: 'ready', post, Body: Body as State extends { Body: infer B } ? B : never });
        }
      } catch (error) {
        if (cancelled) return;
        setState({
          status: 'error',
          message:
            error instanceof RateLimitError
              ? error.message
              : `Could not load this page: ${(error as Error).message}`,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [repo.owner, repo.name, base]);

  if (state.status === 'loading') {
    return (
      <div className="octopage-article" aria-busy="true">
        <Text as="p" size="300" variant="muted">
          Loading…
        </Text>
      </div>
    );
  }

  if (state.status === 'missing') {
    return (
      <div className="octopage-article">
        <Heading as="h1" size="3">
          Not found
        </Heading>
        <Text as="p" size="300" variant="muted">
          Nothing is published at this address.
        </Text>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="octopage-article">
        <Heading as="h1" size="3">
          Could not load
        </Heading>
        <Text as="p" size="300" variant="muted">
          {state.message}
        </Text>
      </div>
    );
  }

  const { post, Body } = state;

  return (
    <>
      <article className="octopage-article">
        <Heading as="h1" size="2">
          {post.title}
        </Heading>

        <div className="octopage-meta">
          <PostMeta date={post.date} author={post.author} labels={post.labels} />
        </div>

        <Body components={discussionScope} />

        <p>
          <Text as="span" size="200" variant="muted">
            <a href={post.discussionUrl}>Discuss this page on GitHub →</a>
          </Text>
        </p>
      </article>

      {giscus && <Comments attrs={{ ...giscus, 'data-mapping': 'number', 'data-term': String(post.number) }} />}
    </>
  );
}

export default DiscussionPage;
