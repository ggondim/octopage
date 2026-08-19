# octopage

A template repository for a **100% static** personal site or blog whose content
and comments both live in a public GitHub repository — no CMS, no database, no
server.

- **Content** comes from the GitHub API: either Discussions, or `.mdx` committed
  to the repo.
- **Comments** are GitHub Discussions threads, rendered by [giscus](https://giscus.app).
- **UI** is [GitHub Primer Brand](https://primer.style/brand).
- **Deploy** targets GitHub Pages, with Vercel supported through the same build.

## Quick start

```bash
npx create-octopage        # interactive setup
pnpm install
pnpm dev
```

## Choosing a source

Setup asks one question that shapes everything else: where you write.

### 1. GitHub Discussions only — recommended

Publish by opening a discussion. Nothing is committed, and you can write from
any device with a browser.

- Metadata goes in an HTML comment at the top of the body, which is invisible in
  both the GitHub editor and the rendered discussion:

  ```markdown
  <!-- octopage
  description: What this post is about
  slug: my-post
  -->

  The body, in MDX.
  ```

- Labels and category come from the discussion itself.
- MDX component tags work in the body. They will not render in GitHub's editor —
  only on the published site.
- URLs default to `/content/[category]/[id]`, and any route can be pinned to a
  specific discussion (see [Custom URL trees](#custom-url-trees)).
- giscus pairs by **discussion number**, so a page's comments are the thread on
  the page's own discussion.

### 2. Code for content, Discussions for comments

Write `.mdx` under `blog/` or `pages/` and preview locally before publishing.

- Metadata, labels and category go in normal `---` frontmatter.
- URLs follow the folder structure; `pages/` maps to the site root, so
  `pages/about.mdx` is served at `/about` and `blog/post.mdx` at `/blog/post`.
- The build **creates the paired discussion** for each page, applying the
  configured labels.
- giscus pairs by **URL pathname**.

Both modes render through the same pipeline. Switching between them changes
where your text is stored, not how a page behaves.

## How it works

Discussions are synced down to MDX files on disk *before* Astro runs, and both
modes then use Astro's stock `glob()` loader plus `@astrojs/mdx`.

This is deliberate. Astro's Content Layer API can fetch remote content into a
custom loader, but its `renderMarkdown()` helper renders Markdown only — there
is no MDX equivalent — so a loader-based path would silently drop the component
tags authors embed in discussion bodies. Going through disk means islands, image
optimization and component imports behave identically no matter where a page
came from.

```
GitHub Discussions ──sync──► .octopage/content/**/*.mdx ──┐
                                                          ├──► glob() ──► @astrojs/mdx ──► dist/
blog/**/*.mdx, pages/**/*.mdx ────────────────────────────┘
```

`.octopage/` is generated and gitignored.

### Why the Primer components cost no JavaScript

Primer Brand's `ThemeProvider` renders a `<div data-color-mode>` plus a React
context that, as of v0.73, **no component in the library actually reads** — the
theming is entirely CSS custom properties keyed off that attribute. octopage
sets the attribute in the Astro layout instead of wrapping the tree in a React
island, so components render to static HTML and never hydrate.

Of the 55 components in the library, 37 hold no state and register no listeners.
A prose page ships **zero bytes** of client JavaScript; only genuinely
interactive components (Accordion, Tabs, SubNav…) become islands, and only on
the pages that use them.

## Configuration

Everything lives in `octopage.config.ts`. See
[`docs/configuration.md`](docs/configuration.md) for the full reference.

### Custom URL trees

Both modes accept a hand-built information architecture layered over the
generated routes:

```ts
routes: {
  '/about':  { discussion: 12 },
  '/uses':   { discussion: 34 },
  '/writing': { redirect: '/blog' },
}
```

A discussion pinned to a custom route is not also published at its default
`/content/...` URL.

## Local preview

`pnpm dev` is the Astro dev server, with HMR — that is what you want while
writing.

The Docker composes are for a different job: previewing the **built** site the
way each host will actually serve it, where base paths, trailing slashes,
directory indexes and 404 routing differ.

```bash
pnpm site:build
docker compose -f docker/docker-compose.yml --profile pages up    # GitHub Pages
docker compose -f docker/docker-compose.yml --profile vercel up   # Vercel
```

## Testing

```bash
pnpm test:e2e
```

Playwright runs against the real build output rather than a dev server, so
base-path bugs — the most common way a working local site breaks once deployed
to a project page — are actually reachable.

## Repository layout

```
packages/octopage/          runtime: Astro integration, GitHub client, sync, layouts
packages/create-octopage/   the interactive setup CLI (Ink)
template/                   the site you get
docker/                     host-emulating preview profiles
e2e/                        Playwright suite
```

## Requirements

- Node 22+
- pnpm 9+
- A GitHub token for builds. The Discussions API is GraphQL-only and rejects
  anonymous requests **even for public repositories**, so builds need one. In
  Actions, `secrets.GITHUB_TOKEN` is enough; locally, an authenticated `gh` CLI
  is picked up automatically.

## License

MIT
