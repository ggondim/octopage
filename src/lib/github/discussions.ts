import { graphql, type GraphQLOptions } from './client.ts';

export interface DiscussionCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isAnswerable: boolean;
}

export interface Discussion {
  id: string;
  number: number;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  lastEditedAt: string | null;
  author: { login: string; avatarUrl: string; url: string } | null;
  authorAssociation: string;
  category: Pick<DiscussionCategory, 'id' | 'name' | 'slug'>;
  labels: Array<{ name: string; color: string; description: string | null }>;
  upvoteCount: number;
  comments: { totalCount: number };
}

export interface RepositoryInfo {
  id: string;
  nameWithOwner: string;
  hasDiscussionsEnabled: boolean;
  categories: DiscussionCategory[];
}

const REPOSITORY_QUERY = /* GraphQL */ `
  query RepositoryInfo($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id
      nameWithOwner
      hasDiscussionsEnabled
      discussionCategories(first: 25) {
        nodes { id name slug description isAnswerable }
      }
    }
  }
`;

/**
 * Repo id plus discussion categories.
 *
 * The CLI needs both: `repoId` for the giscus config, and the category list
 * because there is no API to *create* a discussion category — only the repo
 * settings UI can. So setup can only ever offer what already exists.
 */
export async function fetchRepositoryInfo(
  owner: string,
  name: string,
  options?: GraphQLOptions,
): Promise<RepositoryInfo> {
  const data = await graphql<{
    repository: {
      id: string;
      nameWithOwner: string;
      hasDiscussionsEnabled: boolean;
      discussionCategories: { nodes: DiscussionCategory[] };
    } | null;
  }>(REPOSITORY_QUERY, { owner, name }, options);

  if (!data.repository) {
    throw new Error(`Repository ${owner}/${name} not found, or the token cannot see it.`);
  }

  return {
    id: data.repository.id,
    nameWithOwner: data.repository.nameWithOwner,
    hasDiscussionsEnabled: data.repository.hasDiscussionsEnabled,
    categories: data.repository.discussionCategories.nodes,
  };
}

const DISCUSSION_FIELDS = /* GraphQL */ `
  fragment DiscussionFields on Discussion {
    id
    number
    title
    body
    url
    createdAt
    updatedAt
    lastEditedAt
    author { login avatarUrl url }
    authorAssociation
    category { id name slug }
    labels(first: 50) { nodes { name color description } }
    upvoteCount
    comments { totalCount }
  }
`;

const LIST_QUERY = /* GraphQL */ `
  ${DISCUSSION_FIELDS}
  query ListDiscussions($owner: String!, $name: String!, $cursor: String, $categoryId: ID) {
    repository(owner: $owner, name: $name) {
      discussions(
        first: 50
        after: $cursor
        categoryId: $categoryId
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        pageInfo { hasNextPage endCursor }
        nodes { ...DiscussionFields }
      }
    }
  }
`;

type RawDiscussion = Omit<Discussion, 'labels'> & { labels: { nodes: Discussion['labels'] } };

function normalize(raw: RawDiscussion): Discussion {
  return { ...raw, labels: raw.labels.nodes };
}

/**
 * Every discussion in the repo, optionally narrowed to one category.
 *
 * Paginates to exhaustion: a site's whole content set has to be present for a
 * static build, and a partial fetch would silently drop pages.
 */
export async function fetchDiscussions(
  owner: string,
  name: string,
  opts: { categoryId?: string } & GraphQLOptions = {},
): Promise<Discussion[]> {
  const { categoryId, ...gql } = opts;
  const all: Discussion[] = [];
  let cursor: string | null = null;

  do {
    const data: {
      repository: {
        discussions: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: RawDiscussion[];
        };
      } | null;
    } = await graphql(LIST_QUERY, { owner, name, cursor, categoryId: categoryId ?? null }, gql);

    if (!data.repository) throw new Error(`Repository ${owner}/${name} not found.`);

    all.push(...data.repository.discussions.nodes.map(normalize));
    cursor = data.repository.discussions.pageInfo.hasNextPage
      ? data.repository.discussions.pageInfo.endCursor
      : null;
  } while (cursor);

  return all;
}

const BY_NUMBER_QUERY = /* GraphQL */ `
  ${DISCUSSION_FIELDS}
  query DiscussionByNumber($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      discussion(number: $number) { ...DiscussionFields }
    }
  }
`;

/** Used to resolve custom route entries that point at a specific discussion. */
export async function fetchDiscussionByNumber(
  owner: string,
  name: string,
  number: number,
  options?: GraphQLOptions,
): Promise<Discussion | null> {
  const data = await graphql<{ repository: { discussion: RawDiscussion | null } | null }>(
    BY_NUMBER_QUERY,
    { owner, name, number },
    options,
  );
  const discussion = data.repository?.discussion;
  return discussion ? normalize(discussion) : null;
}
