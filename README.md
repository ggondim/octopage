# octopage

A template repository for a **fully static** personal site or blog whose content
and comments both live in a public GitHub repository. No CMS, no database, no
server.

- **Content** comes from two places at once: `.mdx` committed under
  `src/content`, prerendered at build time — and the repository's **GitHub
  Discussions**, fetched in the reader's browser, so publishing one needs no
  build at all.
- **Comments** are Discussions threads rendered by [giscus](https://giscus.app).
- **UI** is [GitHub Primer Brand](https://primer.style/brand).
- **Deploy** targets GitHub Pages; Vercel works too, with its own `base`.

## Quick start

```bash
pnpm install
pnpm setup     # interactive; removes itself when done
pnpm dev
```

## Two sources, always both

You do not pick a mode. A page is whichever kind it is, and both render through
the same layout.

### Committed — `src/content/**/*.mdx`

```
src/content/blog/hello.mdx   →  /blog/hello
src/content/pages/about.mdx  →  /about        (a `pages` directory maps to the root)
```

Ordinary `---` frontmatter. Previewable locally before publishing. Because these
files are reviewed like any other code, they may `import` components.

giscus pairs them on the **URL pathname**, and the giscus bot opens the thread
when a reader first comments.

### Discussions — fetched in the browser, no build

Open a discussion and it is live. Nothing is committed, no CI runs, and nothing
on disk changes:

```
dist/ written at        18:29:29
discussion created at   18:30:30
page renders            title, body, components — no rebuild
```

This works because `/repos/{owner}/{repo}/discussions` answers **unauthenticated**
and sends `access-control-allow-origin: *`. (GraphQL does not — it 403s without a
token, which is why this used to require a build step.) The browser fetches the
list, finds the discussion whose route matches the URL, compiles its body and
renders it.

Routing has no server, so GitHub Pages' `404.html` is the resolver: any path
without a file lands there, and `src/pages/404.astro` mounts the island that
works out what belongs at that address.

Metadata goes in an HTML comment, invisible both in GitHub's editor and in the
rendered discussion:

```markdown
<!-- octopage
description: What this post is about
slug: my-post
-->

The body, in MDX.
```

Labels and category come from the discussion itself. Routes default to
`/content/[category]/[slug]`.

giscus pairs these on the **discussion number** — the page *is* the discussion,
so its comments are that discussion's comments and nothing new is ever created.

#### What this costs

Being honest about the trade, since it is not free:

| | committed `.mdx` | discussion |
|---|---|---|
| in the initial HTML | yes | no |
| indexed by crawlers that skip JS | yes | no |
| HTTP status | 200 | **404** (the Pages fallback) |
| client JavaScript | none | ~217 KB gzip, mostly the MDX compiler |
| publishing | push + build | instant |
| rate limit | none | 60/hour per IP, cached per session |

Committed content stays prerendered precisely so the site does not depend on any
of that.

#### The security boundary

Anyone with a GitHub account can open a discussion in a public repository, and
bodies are compiled as MDX — which evaluates JavaScript, here in the reader's
browser. The defence is **`author_association`**: only discussions by `OWNER`,
`MEMBER` or `COLLABORATOR` are rendered. That field comes from GitHub's response,
so a visitor cannot forge it, and it narrows the risk to someone who already has
write access — who could ship malicious JavaScript by pushing a commit anyway.

Comment threads are told apart from content by the `<!-- sha1: … -->` marker
giscus embeds, so both can share a category without colliding.

## Documentation

- **[The octopage guide](docs/guide.md)** — why this stack, how to author content,
  how to publish, and how styling works.
- [Configuration reference](docs/configuration.md)

## Configuration

Almost nothing. `octopage.config.ts` with `{}` is a complete configuration.

| Fact | Where it comes from |
|---|---|
| Repository | the `origin` git remote, or `GITHUB_REPOSITORY` in Actions |
| giscus repo id / category id | the public REST API — no token needed |
| Site URL and base path | `astro.config.mjs` (`site`, `base`) |
| Site name and tagline | `package.json` (`name`, `description`) |
| Comment category | `Announcements` if it exists, else the first usable one |

What remains is what cannot be inferred — see
[`docs/configuration.md`](docs/configuration.md):

```ts
export default defineConfig({
  routes: {
    '/about': { discussion: 12 },     // pin a URL to a discussion
    '/uses':  { entry: 'pages/uses' },// pin a URL to a committed file
    '/old':   { redirect: '/new' },
  },
});
```

## Why the Primer components cost no JavaScript

Primer Brand's `ThemeProvider` renders a `<div data-color-mode>` plus a React
context that, as of v0.73, **no component in the library reads** — theming is
entirely CSS custom properties keyed off that attribute. The layout sets the
attribute in Astro instead of wrapping the tree in a React island, so components
render to static HTML and never hydrate.

37 of the library's 55 components hold no state and register no listeners. A
prose page ships **zero bytes** of first-party JavaScript.

One caveat: Primer's *compound* components (`Hero`, `Card`, `Accordion`)
coordinate through React context between a parent and its subcomponents.
Composing them directly in an `.astro` file gives each subcomponent its own
React root and the render fails. Compose them inside a `.tsx` and expose one
component to Astro — see `src/components/SiteHero.tsx`.

## Previewing the build the way each host serves it

`pnpm dev` is the Astro dev server, with HMR — that is what you want while
writing. The Docker profiles are for a different job: previewing the **built**
site under each host's semantics, where base paths, trailing slashes, directory
indexes and 404 routing differ.

```bash
pnpm preview:pages     # GitHub Pages
pnpm preview:vercel    # Vercel
pnpm preview:down
```

### The same build cannot serve both hosts

GitHub Pages project sites live under `/<repo>`; Vercel serves from the web
root. `base` is compiled into every asset URL, so a build made for one 404s
every stylesheet and script on the other — while still returning 200 for the
pages themselves, which makes it look like it works.

| Built with `base: '/octopage'` | pages | assets |
|---|---|---|
| `preview:pages` | 200 | 200 |
| `preview:vercel` | 200 | **404** |

Deploying to Vercel means building with `base: '/'`.

### What the `pages` profile is really testing

It reproduces the decision GitHub Pages makes before serving: if `.nojekyll` is
present at the root of the published tree, Jekyll is skipped and files are
served as-is; otherwise the tree goes through Jekyll first — which drops every
top-level path starting with an underscore, including Astro's `_astro/`.

`.nojekyll` is a **GitHub Pages** convention, not a Jekyll feature: Jekyll itself
ignores the file. Delete `public/.nojekyll`, rebuild, and this profile shows you
the broken site instead of production doing so.

The Jekyll image is amd64-only, so on Apple Silicon it runs under emulation.

## Testing

```bash
pnpm test
```

Playwright runs against the real build output, served under the configured base
path, so base-path bugs — the most common way a working local site breaks once
deployed to a project page — are reachable from a test.

The suite runs with `OCTOPAGE_OFFLINE=1`: it asserts on rendering and routing,
not on content freshness, and a fork's pull request has no token to reach the
API with anyway.

## Layout

```
src/content/        committed .mdx (blog/, pages/)
src/components/     Primer Brand composition (.tsx)
src/layouts/        page shells (.astro)
src/lib/            runtime: REST client, content filtering, routing, giscus
src/pages/          static routes; 404.astro is the dynamic resolver
setup/              the interactive setup — deletes itself after running
scripts/serve.mjs   static server used by the Docker vercel profile and by tests
docker/             preview profiles
e2e/                Playwright
```

## Requirements

- Node 22+, pnpm 9+
- **No GitHub token.** Everything the build reads — the repository's node id and
  its discussion categories — comes from public REST endpoints. `OCTOPAGE_OFFLINE=1`
  skips those calls entirely, which is what CI uses.

## License

MIT
