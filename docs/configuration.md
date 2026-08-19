# Configuration reference

`octopage.config.ts` holds only what cannot be derived. `defineConfig({})` is a
complete, working configuration.

## What is derived, and from where

| Fact | Source | Override |
|---|---|---|
| Repository (`owner/name`) | `GITHUB_REPOSITORY`, else the `origin` git remote | — |
| Site URL, base path | `astro.config.mjs` → `site`, `base` | edit astro.config.mjs |
| Site name, tagline | `package.json` → `name`, `description` | edit package.json |
| giscus `repoId`, `categoryId` | GitHub API at build time | — |
| Comment category | `Announcements`, else the first non-answerable category | `comments` |
| giscus `mapping` | the page: `number` for a discussion, `pathname` for a file | — |

The mapping is not settable. It has to match how the page was sourced, or the
comment thread does not resolve at all.

## `routes`

The one thing no file already answers: a deliberate information architecture.

```ts
routes: {
  '/about':  { discussion: 12 },       // pin a URL to a discussion
  '/uses':   { entry: 'pages/uses' },  // pin a URL to a committed entry
  '/old':    { redirect: '/new' },     // or an absolute URL
}
```

A pinned page is **not** also published at its derived URL. Serving one page at
two URLs would split its comment thread, because giscus pairs committed pages on
the pathname.

Redirects are emitted through Astro's `redirects` option, with the deploy base
prepended to internal targets — Astro applies `base` to a redirect's source but
emits its destination verbatim, so a target without it 404s once deployed to a
project page.

## `discussions` (optional)

Narrows which discussions become pages. Left out, every discussion in every
category is content.

```ts
discussions: {
  categories: ['Announcements'],  // default: all
  labels: ['published'],          // default: all
  draftLabel: 'draft',            // discussions with this label are skipped
  basePath: '/content',           // route prefix
}
```

Always excluded, regardless of this setting:

- **Comment threads**, identified by the `<!-- sha1: … -->` marker giscus embeds
  in threads it creates (and that octopage embeds in any it creates).
- **Discussions from untrusted authors.** Only `OWNER`, `MEMBER` and
  `COLLABORATOR` are published. Anyone can open a discussion in a public
  repository, and the build compiles bodies as MDX, which evaluates JavaScript —
  publishing only what someone with write access wrote is what keeps a
  passer-by from running code in CI.

## `comments` (optional)

```ts
comments: 'Announcements'
```

The category name holding comment threads. Left out, `Announcements` is used
when present — giscus recommends it because only maintainers can open threads
there — and otherwise the first non-answerable category.

> Discussion categories **cannot be created through the GitHub API** — neither
> GraphQL nor REST exposes a mutation for it. The build can only choose among
> categories that already exist, and fails with an actionable message naming
> what to create if none is usable.

## Discussion bodies

Frontmatter goes in an HTML comment so it stays invisible on GitHub:

```markdown
<!-- octopage
description: What this is about
slug: my-post
route: /somewhere-else
-->
```

Recognised keys are the same as file frontmatter: `title` (defaults to the
discussion title), `description`, `date`, `slug`, `route`, `draft`.

**Bodies may not `import`.** Components come from a fixed scope in
`src/components/mdx.tsx` and are used by name. Add to that file to widen what
authors can reach.

## Environment

| Variable | Purpose |
|---|---|
| `OCTOPAGE_GITHUB_TOKEN` | Explicit token; wins over everything else. |
| `GITHUB_TOKEN` | What Actions injects. |
| `GITHUB_REPOSITORY` | `owner/name`; set by Actions, overrides the git remote. |
| `OCTOPAGE_OFFLINE=1` | Skip every GitHub call. Discussion content falls back to the last build's cache, and comments are omitted rather than rendered broken. Used by CI and by local gates. |

With none of these set, an authenticated `gh` CLI is used, so a local dev server
works with no configuration.
