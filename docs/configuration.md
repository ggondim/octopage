# Configuration reference

All configuration lives in `octopage.config.ts` at the site root.

```ts
import { defineConfig } from 'octopage/config';

export default defineConfig({ /* … */ });
```

## `site`

| Key | Type | Default | Notes |
|---|---|---|---|
| `title` | `string` | — | Required. |
| `description` | `string` | `''` | Used for meta description and the home page. |
| `url` | `string` | — | Absolute origin, e.g. `https://you.github.io`. Required for canonical URLs and the sitemap. |
| `base` | `string` | `'/'` | Sub-path for project sites, e.g. `/octopage`. |
| `lang` | `string` | `'en'` | |

**`base` is part of comment pairing, not just asset URLs.** giscus derives its
search term from `location.pathname` in the browser, so a site served under
`/octopage` pairs on `octopage/blog/post/`. Changing `base` after publishing
orphans every existing comment thread.

## `repo`

```ts
repo: { owner: 'you', name: 'your-repo' }
```

The repository holding content, comments, or both. Must be public for readers to
see the discussions.

## `source`

`'discussions' | 'code'` — see the README for what each mode means.

## `discussions`

Applies to `source: 'discussions'`.

| Key | Type | Default | Notes |
|---|---|---|---|
| `contentCategories` | `string[]` | `['General']` | Categories whose discussions become pages. |
| `draftLabel` | `string` | `'draft'` | Discussions with this label are skipped. |
| `basePath` | `string` | `'/content'` | Prefix for generated routes. |

> Discussion categories **cannot be created through the GitHub API** — neither
> GraphQL nor REST exposes a mutation for it. Create them under
> *Settings → Discussions* first; setup can only offer categories that already
> exist.

## `code`

Applies to `source: 'code'`.

| Key | Type | Default | Notes |
|---|---|---|---|
| `dirs` | `string[]` | `['blog', 'pages']` | Directories scanned for `.mdx`/`.md`. A directory named `pages` maps to the site root. |
| `createDiscussions` | `boolean` | `true` | Whether the build creates the paired discussion. Needs `discussions: write`. |

## `comments`

`false` to disable, or:

| Key | Type | Default | Notes |
|---|---|---|---|
| `repo` | `{owner, name}` | the content repo | Where comment threads live. |
| `repoId` | `string` | — | From <https://giscus.app>. Not derivable offline. |
| `category` | `string` | — | Category name. |
| `categoryId` | `string` | — | From giscus. |
| `strict` | `boolean` | `true` | Match on a hash of the title instead of fuzzy search. |
| `reactionsEnabled` | `boolean` | `true` | |
| `inputPosition` | `'top' \| 'bottom'` | `'bottom'` | |
| `theme` | `string` | `'preferred_color_scheme'` | |
| `lang` | `string` | `'en'` | |

The giscus `mapping` is **not** configurable — it is determined by `source`
(`number` for discussions mode, `pathname` for code mode), because the two have
to agree for comments to resolve at all.

With `strict: true`, discussions octopage creates embed the SHA-1 of their title
in the body, which is what giscus's strict mode searches for. Discussions
created by hand before enabling strict mode need that hash pasted into the body
to keep resolving.

## `routes`

A custom URL tree layered over the generated routes:

```ts
routes: {
  '/about': { discussion: 12 },   // pin a URL to a discussion
  '/notes': { entry: 'blog/notes' }, // pin a URL to a content entry
  '/old':   { redirect: '/new' },
}
```

## Environment

| Variable | Purpose |
|---|---|
| `OCTOPAGE_GITHUB_TOKEN` | Explicit token; wins over everything else. |
| `GITHUB_TOKEN` | What Actions injects. |
| `OCTOPAGE_OFFLINE=1` | Skip all GitHub calls. Builds from whatever the last sync left on disk — used by CI and by the local quality gates. |

With none of these set, an authenticated `gh` CLI is used, so a local dev server
works with no configuration.
