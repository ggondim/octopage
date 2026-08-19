import { createHash } from 'node:crypto';
import { graphql, type GraphQLOptions } from './client.ts';
import { fetchDiscussions, type Discussion } from './discussions.ts';

/**
 * giscus strict mode looks for the SHA-1 of the discussion title *inside the
 * body*, rather than matching title text, because GitHub's discussion search is
 * fuzzy enough to return a neighbouring thread. giscus embeds this itself for
 * discussions it creates; when we create the discussion at build time we have
 * to embed it, or strict mode finds nothing and every page shows an empty box.
 */
export function giscusTitleHash(title: string): string {
  return createHash('sha1').update(title).digest('hex');
}

export function giscusHashComment(title: string): string {
  return `<!-- sha1: ${giscusTitleHash(title)} -->`;
}

const CREATE_DISCUSSION = /* GraphQL */ `
  mutation CreateDiscussion($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
    createDiscussion(
      input: { repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body }
    ) {
      discussion { id number url title }
    }
  }
`;

const LABEL_IDS = /* GraphQL */ `
  query LabelIds($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      labels(first: 100) { nodes { id name } }
    }
  }
`;

const ADD_LABELS = /* GraphQL */ `
  mutation AddLabels($labelableId: ID!, $labelIds: [ID!]!) {
    addLabelsToLabelable(input: { labelableId: $labelableId, labelIds: $labelIds }) {
      clientMutationId
    }
  }
`;

export interface CreatedDiscussion {
  id: string;
  number: number;
  url: string;
  title: string;
}

export interface EnsureDiscussionInput {
  owner: string;
  name: string;
  repositoryId: string;
  categoryId: string;
  /**
   * The exact term giscus will search for — compute it with
   * `giscusPathnameTerm(pathname)`, never by hand from the route.
   */
  term: string;
  /** Link back to the published page, so the discussion is not context-free. */
  pageUrl?: string;
  labels?: string[];
  /** Extra prose placed above the backlink. */
  intro?: string;
}

/**
 * Find, or create, the discussion that giscus will attach comments to.
 *
 * Idempotent by design: the build runs on every push, and creating a second
 * discussion for a page would split its comment thread irreversibly. The lookup
 * mirrors giscus's own matching (title *contains* the term) so we never create
 * a duplicate of a discussion giscus would have found.
 */
export async function ensureDiscussionForTerm(
  input: EnsureDiscussionInput,
  options?: GraphQLOptions,
): Promise<{ discussion: CreatedDiscussion; created: boolean }> {
  const existing = await findDiscussionByTerm(input.owner, input.name, input.categoryId, input.term, options);
  if (existing) {
    return {
      discussion: { id: existing.id, number: existing.number, url: existing.url, title: existing.title },
      created: false,
    };
  }

  const body = buildBody(input);

  const data = await graphql<{ createDiscussion: { discussion: CreatedDiscussion } }>(
    CREATE_DISCUSSION,
    {
      repositoryId: input.repositoryId,
      categoryId: input.categoryId,
      title: input.term,
      body,
    },
    options,
  );

  const discussion = data.createDiscussion.discussion;

  if (input.labels?.length) {
    await applyLabels(input.owner, input.name, discussion.id, input.labels, options);
  }

  return { discussion, created: true };
}

function buildBody(input: EnsureDiscussionInput): string {
  const parts: string[] = [];
  if (input.intro) parts.push(input.intro);
  if (input.pageUrl) parts.push(`💬 Comments for [${input.term}](${input.pageUrl}).`);
  else parts.push(`💬 Comments for \`${input.term}\`.`);
  parts.push('This discussion is created and paired automatically by octopage.');
  // Must be present for `data-strict="1"` to ever resolve this discussion.
  parts.push(giscusHashComment(input.term));
  return parts.join('\n\n');
}

/**
 * Locate a discussion the way giscus does: same category, title *containing*
 * the term. Exact matches win over substring ones so that `blog/post` cannot be
 * shadowed by a pre-existing `blog/post-two`.
 */
export async function findDiscussionByTerm(
  owner: string,
  name: string,
  categoryId: string,
  term: string,
  options?: GraphQLOptions,
): Promise<Discussion | null> {
  const discussions = await fetchDiscussions(owner, name, { categoryId, ...options });
  return (
    discussions.find((d) => d.title === term) ??
    discussions.find((d) => d.title.includes(term)) ??
    null
  );
}

/** Labels must exist already — `addLabelsToLabelable` takes ids, not names. */
export async function applyLabels(
  owner: string,
  name: string,
  labelableId: string,
  labels: string[],
  options?: GraphQLOptions,
): Promise<{ applied: string[]; missing: string[] }> {
  const data = await graphql<{ repository: { labels: { nodes: Array<{ id: string; name: string }> } } | null }>(
    LABEL_IDS,
    { owner, name },
    options,
  );

  const byName = new Map((data.repository?.labels.nodes ?? []).map((l) => [l.name.toLowerCase(), l.id]));
  const applied: string[] = [];
  const missing: string[] = [];
  const ids: string[] = [];

  for (const label of labels) {
    const id = byName.get(label.toLowerCase());
    if (id) {
      ids.push(id);
      applied.push(label);
    } else {
      missing.push(label);
    }
  }

  if (ids.length) await graphql(ADD_LABELS, { labelableId, labelIds: ids }, options);

  return { applied, missing };
}
