import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface RepoRef {
  owner: string;
  name: string;
}

/** Parse `owner/name` out of any GitHub remote URL form. */
export function parseRemote(url: string): RepoRef | null {
  const match = url
    .trim()
    .replace(/\.git$/, '')
    .match(/github\.com[:/]([^/]+)\/([^/]+)$/);
  return match ? { owner: match[1], name: match[2] } : null;
}

/** Best-effort guess of the repo from the working directory's git remote. */
export async function detectRepo(cwd: string): Promise<RepoRef | null> {
  try {
    const { stdout } = await run('git', ['remote', 'get-url', 'origin'], { cwd });
    return parseRemote(stdout);
  } catch {
    return null;
  }
}

export async function ghAvailable(): Promise<boolean> {
  try {
    await run('gh', ['auth', 'status']);
    return true;
  } catch {
    return false;
  }
}

export async function ghToken(): Promise<string | null> {
  try {
    const { stdout } = await run('gh', ['auth', 'token']);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  isAnswerable: boolean;
}

export interface RepoState {
  id: string;
  hasDiscussionsEnabled: boolean;
  categories: Category[];
}

const QUERY = `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){id hasDiscussionsEnabled discussionCategories(first:25){nodes{id name slug isAnswerable}}}}`;

export async function fetchRepoState(repo: RepoRef, token: string): Promise<RepoState> {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'create-octopage',
    },
    body: JSON.stringify({ query: QUERY, variables: { owner: repo.owner, name: repo.name } }),
  });

  if (!response.ok) throw new Error(`GitHub responded ${response.status}`);

  const payload = (await response.json()) as {
    data?: {
      repository: {
        id: string;
        hasDiscussionsEnabled: boolean;
        discussionCategories: { nodes: Category[] };
      } | null;
    };
    errors?: Array<{ message: string }>;
  };

  if (payload.errors?.length) throw new Error(payload.errors.map((e) => e.message).join('; '));
  if (!payload.data?.repository) throw new Error(`Repository ${repo.owner}/${repo.name} not found.`);

  return {
    id: payload.data.repository.id,
    hasDiscussionsEnabled: payload.data.repository.hasDiscussionsEnabled,
    categories: payload.data.repository.discussionCategories.nodes,
  };
}

/**
 * Turn Discussions on for the repository.
 *
 * Note the asymmetry, which shapes the whole setup flow: *enabling* Discussions
 * is a plain repo-settings PATCH, but there is no API — GraphQL or REST — to
 * *create a discussion category*. Setup can therefore only ever offer the
 * categories that already exist, and has to send the user to the settings UI
 * when they want a new one.
 */
export async function enableDiscussions(repo: RepoRef, token: string): Promise<boolean> {
  const response = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'create-octopage',
    },
    body: JSON.stringify({ has_discussions: true }),
  });

  if (!response.ok) return false;
  const body = (await response.json()) as { has_discussions?: boolean };
  return body.has_discussions === true;
}

export function categorySettingsUrl(repo: RepoRef): string {
  return `https://github.com/${repo.owner}/${repo.name}/discussions/categories`;
}

export function giscusUrl(): string {
  return 'https://giscus.app';
}
