---
name: launch
description: >-
  Publishes the current branch to production (GitHub Pages). Runs the quality
  gates, commits what is outstanding, merges into main, pushes (which triggers
  the deploy) and follows the GitHub Actions run until it is green. Use when the
  user says "launch", "ship it", "deploy", "push to prod", or otherwise wants to
  publish the current branch. Optionally takes a commit message as an argument.
---

# /launch — publish to production

Finishing flow: feature branch → `main` → GitHub Pages. **Pushing to `main`
triggers the deploy** (`.github/workflows/deploy.yml` → Astro build →
`actions/deploy-pages`). The user invoked `/launch`, so the intent to deploy is
explicit — but **report every step** and **stop if any gate fails**.

## 0. Establish context

```bash
git branch --show-current    # must not be main
git status --short
gh repo view --json nameWithOwner,homepageUrl --jq '.'
```

If already on `main`, or there is no feature branch, **stop** and say there is
nothing to publish.

## 1. Quality gates

```bash
pnpm typecheck
OCTOPAGE_OFFLINE=1 pnpm build
pnpm test
```

If any of these **fail**, **stop** and report the raw output — do not commit.

`OCTOPAGE_OFFLINE=1` on the local gate is deliberate. A normal build reads the
GitHub API for discussion content and for the giscus repo/category ids, and a
gate should not depend on the network. The deploy runs **without** the flag.

## 2. Commit what is outstanding

If `git status --short` shows uncommitted work:

- Stage only the feature's files. Never `node_modules/`, `dist/`,
  `.pnpm-store/`, `test-results/`, `playwright-report/`, `.env`.
- Short conventional-commit message (`feat(...)`, `fix(...)`).
- If the user passed an argument to `/launch`, use it as the basis.
- Trailer: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## 3. Merge into main and push

```bash
git fetch origin --quiet
git checkout main
git pull --ff-only
git merge --ff-only "$FEAT"
git push origin main
```

Always **`--ff-only`**: if the merge is not a fast-forward, **stop** and report
that main has diverged — that call is the user's.

If the repository uses pull requests, prefer `gh pr create` + `gh pr merge` and
**wait for the checks** rather than merging locally.

## 4. Clean up

```bash
git branch -d "$FEAT"
git push origin --delete "$FEAT" 2>/dev/null || true
rm -rf test-results playwright-report
```

## 5. Follow the deploy

```bash
gh run list --branch main --limit 1
gh run watch <run-id> --exit-status
```

- **Green**: report the commit and the published URL
  (`gh repo view --json homepageUrl`). Optionally `curl -sI <url>` to confirm 200.
- **Red**: report the failing step (`gh run view <id> --log-failed`) and **do
  not** redeploy on your own — the code is already on main. Tell the user.

Deploy failures that local gates cannot catch are almost always one of these:

- **Token.** The real build reads the GitHub API. The job needs `GITHUB_TOKEN`,
  and `discussions: read` at minimum.
- **Base path.** A wrong `base` in astro.config.mjs publishes a site whose every
  asset 404s while the pages themselves return 200. `e2e/site.spec.ts` covers
  this — if it passed, the base is right for this repository.
- **Discussions disabled**, or no usable category for comments. The build stops
  with an explicit message naming what to create.

## Guardrails

- Never force push. Never commit secrets.
- Only publish the current session's branch.
- Any failing step → stop and report. Do not paper over an error to keep the
  flow going.
