import { execFileSync } from 'node:child_process';

export interface RepoRef {
  owner: string;
  name: string;
}

export function parseRemote(url: string): RepoRef | null {
  const match = url.trim().replace(/\.git$/, '').match(/github\.com[:/]([^/]+)\/([^/]+)$/);
  return match ? { owner: match[1], name: match[2] } : null;
}

let cached: RepoRef | null | undefined;

/**
 * Which repository the content and comments live in.
 *
 * Derived rather than configured: the site *is* the repository, so asking the
 * author to restate its name in a config file only creates a second place for
 * it to be wrong after a rename or a fork. `GITHUB_REPOSITORY` covers Actions,
 * the git remote covers everything else.
 */
export function resolveRepo(): RepoRef {
  if (cached) return cached;

  const fromActions = process.env.GITHUB_REPOSITORY;
  if (fromActions?.includes('/')) {
    const [owner, name] = fromActions.split('/');
    return (cached = { owner, name });
  }

  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const parsed = parseRemote(remote);
    if (parsed) return (cached = parsed);
  } catch {
    // Not a git checkout, or no origin — fall through.
  }

  throw new Error(
    'Could not determine which GitHub repository this site belongs to.\n' +
      'Add an `origin` remote pointing at GitHub, or set GITHUB_REPOSITORY=owner/name.',
  );
}
