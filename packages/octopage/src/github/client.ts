import { execFileSync } from 'node:child_process';

const GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';

export class GitHubError extends Error {
  constructor(message: string, readonly errors?: unknown) {
    super(message);
    this.name = 'GitHubError';
  }
}

let cachedToken: string | null | undefined;

/**
 * Resolve a GitHub token.
 *
 * Discussions are GraphQL-only, and the GraphQL endpoint rejects anonymous
 * requests outright — even for a public repository — so a token is required
 * regardless of repo visibility. Order of preference:
 *
 *   1. `OCTOPAGE_GITHUB_TOKEN` — explicit, wins everywhere.
 *   2. `GITHUB_TOKEN` — what Actions injects.
 *   3. `gh auth token` — so a local dev server works with no setup at all.
 */
export function resolveToken(): string {
  if (cachedToken !== undefined) {
    if (cachedToken === null) throw noTokenError();
    return cachedToken;
  }

  const fromEnv = process.env.OCTOPAGE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (fromEnv) return (cachedToken = fromEnv);

  try {
    const token = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (token) return (cachedToken = token);
  } catch {
    // gh missing or logged out — fall through to the actionable error.
  }

  cachedToken = null;
  throw noTokenError();
}

function noTokenError(): Error {
  return new GitHubError(
    'No GitHub token available, and the Discussions API has no anonymous access.\n' +
      'Provide one of:\n' +
      '  - OCTOPAGE_GITHUB_TOKEN / GITHUB_TOKEN in the environment\n' +
      '  - an authenticated `gh` CLI (`gh auth login`)\n' +
      'In GitHub Actions, pass `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` to the build step.',
  );
}

export interface GraphQLOptions {
  /** Overrides the resolved token, used by the CLI where the user supplies one. */
  token?: string;
  signal?: AbortSignal;
}

/** Minimal GraphQL client. Kept dependency-free so the runtime stays small. */
export async function graphql<T>(
  query: string,
  variables: Record<string, unknown> = {},
  options: GraphQLOptions = {},
): Promise<T> {
  const token = options.token ?? resolveToken();

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Discussions moved out of preview long ago, but the explicit Accept
      // keeps us on the documented JSON shape.
      Accept: 'application/vnd.github+json',
      'User-Agent': 'octopage',
    },
    body: JSON.stringify({ query, variables }),
    signal: options.signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (response.status === 401) {
      throw new GitHubError('GitHub rejected the token (401). Is it expired, or missing the `read:discussion` scope?');
    }
    if (response.status === 403 && body.includes('rate limit')) {
      throw new GitHubError('GitHub API rate limit exceeded. Retry later, or use a token with a higher quota.');
    }
    throw new GitHubError(`GitHub GraphQL responded ${response.status}: ${body.slice(0, 500)}`);
  }

  const payload = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };

  if (payload.errors?.length) {
    const summary = payload.errors.map((e) => e.message).join('; ');
    throw new GitHubError(`GitHub GraphQL error: ${summary}`, payload.errors);
  }
  if (!payload.data) throw new GitHubError('GitHub GraphQL returned no data.');

  return payload.data;
}
