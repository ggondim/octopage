/**
 * Anonymous REST client for repository Discussions.
 *
 * This runs in two places with the same code: at build time to resolve the
 * giscus ids, and in the reader's browser to fetch content.
 *
 * The GraphQL API rejects anonymous requests, which is why earlier versions of
 * this project needed a token and a build step to read discussions at all. REST
 * does not: `/repos/{owner}/{repo}/discussions` answers unauthenticated, sends
 * `access-control-allow-origin: *`, and returns everything needed — body,
 * labels, category (with its node id) and author_association. That is what
 * makes content live rather than baked.
 *
 * The budget is 60 requests per hour per IP, so responses are cached per
 * session: a reader clicking through ten pages spends one request, not ten.
 */

export interface RestDiscussion {
  number: number;
  title: string;
  body: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  author_association: string;
  user: { login: string; avatar_url: string; html_url: string } | null;
  category: { name: string; slug: string; node_id: string; is_answerable: boolean };
  labels: Array<{ name: string; color: string }>;
  reactions?: { total_count: number };
  comments: number;
}

export interface RepoRef {
  owner: string;
  name: string;
}

const API = 'https://api.github.com';
const CACHE_KEY = 'octopage:discussions';
const CACHE_TTL_MS = 60_000;

export class RateLimitError extends Error {
  constructor(readonly resetAt: Date | null) {
    super(
      'GitHub rate limit reached. Unauthenticated requests are capped at 60 per hour per IP' +
        (resetAt ? `; it resets at ${resetAt.toLocaleTimeString()}.` : '.'),
    );
    this.name = 'RateLimitError';
  }
}

async function get<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });

  if (response.status === 403 || response.status === 429) {
    const remaining = response.headers.get('x-ratelimit-remaining');
    if (remaining === '0') {
      const reset = response.headers.get('x-ratelimit-reset');
      throw new RateLimitError(reset ? new Date(Number(reset) * 1000) : null);
    }
  }
  if (!response.ok) {
    throw new Error(`GitHub responded ${response.status} for ${url}`);
  }

  return (await response.json()) as T;
}

/** Every discussion in the repository, paginated to exhaustion. */
export async function fetchDiscussions(repo: RepoRef): Promise<RestDiscussion[]> {
  const all: RestDiscussion[] = [];
  let page = 1;

  for (;;) {
    const batch = await get<RestDiscussion[]>(
      `${API}/repos/${repo.owner}/${repo.name}/discussions?per_page=100&page=${page}`,
    );
    all.push(...batch);
    if (batch.length < 100) break;
    page++;
  }

  return all;
}

/**
 * Same, cached in sessionStorage.
 *
 * A stale read for up to a minute is a fair trade for not spending a reader's
 * hourly budget on every navigation. Falls straight through when there is no
 * sessionStorage — during SSR, or with storage disabled.
 */
export async function fetchDiscussionsCached(repo: RepoRef): Promise<RestDiscussion[]> {
  const storage = typeof sessionStorage === 'undefined' ? null : sessionStorage;

  if (storage) {
    try {
      const raw = storage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as { at: number; repo: string; data: RestDiscussion[] };
        const key = `${repo.owner}/${repo.name}`;
        if (cached.repo === key && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;
      }
    } catch {
      // Corrupt or unreadable cache is not worth failing a page load over.
    }
  }

  const data = await fetchDiscussions(repo);

  if (storage) {
    try {
      storage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), repo: `${repo.owner}/${repo.name}`, data }));
    } catch {
      // Quota exceeded, private mode — the fetch already succeeded.
    }
  }

  return data;
}

/** The repository's GraphQL node id, which is what giscus wants as `data-repo-id`. */
export async function fetchRepoId(repo: RepoRef): Promise<{ id: string; hasDiscussions: boolean }> {
  const data = await get<{ node_id: string; has_discussions: boolean }>(
    `${API}/repos/${repo.owner}/${repo.name}`,
  );
  return { id: data.node_id, hasDiscussions: data.has_discussions };
}

/**
 * Discussion categories, derived from the discussions themselves.
 *
 * REST has no endpoint for categories — `/discussions/categories` is a 404 —
 * but every discussion carries its category, node id included. The consequence
 * is that a category holding no discussions is invisible here, which matters
 * only for a brand-new repository where giscus has not opened its first thread
 * yet.
 */
export function categoriesFrom(discussions: RestDiscussion[]): RestDiscussion['category'][] {
  const seen = new Map<string, RestDiscussion['category']>();
  for (const d of discussions) if (!seen.has(d.category.node_id)) seen.set(d.category.node_id, d.category);
  return [...seen.values()];
}
