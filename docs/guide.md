# The octopage guide

Why this stack, and how to use it.

- [Why Astro](#why-astro)
- [Why React](#why-react)
- [Why Primer Brand](#why-primer-brand)
- [Why giscus](#why-giscus)
- [Why GitHub Discussions](#why-github-discussions)
- [Authoring content](#authoring-content)
- [Publishing](#publishing)
- [Formatting and styling](#formatting-and-styling)

---

## Why Astro

**The short version: partial hydration, and a content pipeline that already does
what this project needs.**

The site is mostly prose. Prose does not need a JavaScript framework running in
the reader's browser — but the components rendering it are React, because Primer
Brand is React. Astro is the tool that resolves that tension: it renders React
components to HTML at build time and ships client JavaScript only where a
component genuinely needs it.

The numbers from this repository's own dependency:

| Primer Brand v0.73 | count |
|---|---|
| components total | 55 |
| holding state or listeners | 18 |
| purely presentational | **37** |

Those 37 render to static HTML and cost nothing. A committed prose page here
ships **zero bytes** of first-party JavaScript — verified by a test that fails if
any first-party script is ever requested (`e2e/site.spec.ts`).

### What was considered instead

| | weekly downloads | cost for this site |
|---|---|---|
| **Astro** | ~3.9M | a second component model (`.astro`) for the page shell |
| Next.js `output: 'export'` | ~45M | every page hydrates the whole React tree; base-path friction on GitHub Pages |
| vike | ~67k | small ecosystem for an open-source template |
| vite-react-ssg | ~46k | same, more so |

Next.js was the serious alternative — one component model, everything React. It
lost on the thing that matters most here: with a static export, a blog post
ships React plus Primer to the reader in order to display text that never
changes.

The cost of Astro is real but contained: `.astro` files appear only in the page
shell (`src/layouts`, `src/pages`). Everything else — all Primer composition, all
MDX components — is ordinary `.tsx`.

### One sharp edge

Primer's *compound* components (`Hero`, `Card`, `Accordion`) coordinate through
React context between a parent and its subcomponents. Writing that composition
directly in an `.astro` file gives each subcomponent its own React root, and the
render fails:

```
useHeroContext must be used within a HeroProvider
```

Compose them inside a `.tsx` and expose one component to Astro — see
[`src/components/SiteHero.tsx`](../src/components/SiteHero.tsx).

---

## Why React

**Because Primer Brand is React, and nothing else was on offer.**

```
@primer/react-brand peerDependencies:
  react      >=18 <20
  react-dom  >=18 <20
```

There is no Vue, Svelte or web-component build of Primer Brand. Choosing that
design system chooses React with it. This is the one decision in the stack that
follows from another rather than standing on its own.

It matters less than it looks, because of the hydration point above: React runs
at build time to produce HTML, and reaches the reader only on pages that use an
interactive component or the dynamic discussion loader.

---

## Why Primer Brand

**The content lives in GitHub. Looking like GitHub is coherent rather than
derivative.**

Primer Brand is the design system behind github.com's marketing and editorial
pages — as distinct from Primer *React*, which is the product UI (the one that
looks like the repository browser). Brand is the right half for a blog: it has
`Hero`, `Card`, `Pillar`, `Testimonial`, `Timeline`, editorial `Prose`, and a
type scale built for reading.

Three practical reasons beyond taste:

**1. Theming needs no JavaScript.** `ThemeProvider` renders a
`<div data-color-mode>` and a React context. As of v0.73 **no component in the
library reads that context** — theming is entirely CSS custom properties keyed
off the attribute. So the attribute can be set once in the Astro layout and every
component themes correctly with nothing hydrated, and without islands needing to
share a context they cannot share anyway.

**2. It is a complete token system.** Colours, spacing, type and borders are all
`--brand-*` custom properties. `src/styles/octopage.css` sets layout only and
introduces no values of its own — if it did, the site would stop being Primer
Brand and become a fork of it.

**3. Accessibility and dark mode are already handled**, including
`prefers-color-scheme`, focus rings and reduced motion.

The trade-off: it is opinionated and unmistakably GitHub. If you want a site that
looks like *you* rather than like GitHub, this is the wrong starting point.

---

## Why giscus

**Comments are a database, a spam problem and a moderation queue. giscus makes
them someone else's — specifically GitHub's.**

giscus renders a GitHub Discussion as a comment widget. Readers sign in with
GitHub; you moderate on GitHub; the data is in your repository, exportable, and
survives giscus disappearing.

What it costs: readers need a GitHub account, which suits a technical audience
and suits nobody else.

### How a page finds its thread

giscus offers six mapping modes. This project uses two, and picks between them
per page rather than by configuration — the mapping has to match how the page was
sourced, or the thread never resolves:

| page came from | mapping | how the thread is found |
|---|---|---|
| a Discussion | `number` | the page *is* the discussion; its comments are that discussion's comments |
| a committed `.mdx` | `pathname` | giscus searches for a discussion whose title contains the URL path; its bot opens one on the first comment |

The `pathname` term is computed **in the reader's browser**, by giscus:

```js
location.pathname.length < 2
  ? 'index'
  : location.pathname.substring(1).replace(/\.\w+$/, '')
```

It drops the leading slash and a file extension, but **keeps the trailing slash**
and **includes the deploy base path**. So a page at `/blog/post/` pairs on `blog/post/`, and the same page on a
project page under `/repo` pairs on `repo/blog/post/` instead. Deriving that string any other way is the easiest way
to end up with every page showing an empty comment box.

### Setup

Install [the giscus app](https://github.com/apps/giscus) on the repository. Until
you do, the widget renders `giscus is not installed on this repository`.

Everything else is derived at build time — the repository's node id and the
category's node id both come from public REST endpoints, so no token and no
configuration are involved. Override the category with `comments` in
`octopage.config.ts` if the default guess is wrong.

---

## Why GitHub Discussions

**A CMS wants a database, a login, a backup and an invoice. A Discussion already
has an editor, edit history, permissions, search, notifications, reactions and
comments — maintained by someone else.**

The decisive technical fact, measured against the live API:

```
POST https://api.github.com/graphql                          403   (anonymous)
GET  https://api.github.com/repos/{owner}/{repo}/discussions  200   (anonymous)
     access-control-allow-origin: *
```

REST answers unauthenticated **and** allows cross-origin requests. That is what
lets the reader's browser fetch content directly, which in turn is what lets a
discussion go live with no build. (GraphQL requires a token, which is why an
earlier version of this project needed a build step to read content at all.)

The budget is 60 requests per hour per IP. Responses are cached per session, so a
reader clicking through ten pages spends one request.

---

## Authoring content

Two ways, both always active. You do not choose a mode — a page is whichever kind
it is.

### A. Commit an `.mdx` file

```
src/content/blog/hello.mdx   →  /blog/hello
src/content/pages/about.mdx  →  /about        (a `pages` directory maps to the root)
src/content/blog/index.mdx   →  /blog
```

```mdx
---
title: Hello
description: Shown on cards and in meta tags
date: 2026-08-19
labels: [announcement]
draft: false
---

import { Label, Stack } from '@primer/react-brand';

Ordinary MDX. Because this file is reviewed like any other code, it may
`import` anything.

<Stack direction="horizontal" gap="condensed" padding="none">
  <Label size="large" color="green">works</Label>
</Stack>
```

Preview with `pnpm dev` before publishing. Requires a push and a build.

### B. Open a GitHub Discussion

Write it in GitHub's editor. It is live immediately — no commit, no CI run.

Metadata goes in an HTML comment, which is invisible both in the editor and in
the rendered discussion, so the discussion still reads correctly to someone who
finds it on GitHub:

```markdown
<!-- octopage
description: Shown on cards and in meta tags
slug: my-post
-->

The body. GitHub Flavoured Markdown, plus components by name.

<Stack direction="horizontal" gap="condensed" padding="none">
  <Label size="large" color="green">works</Label>
</Stack>
```

Recognised keys: `title` (defaults to the discussion title), `description`,
`slug`, `route`, `date`, `draft`.

**Discussion bodies may not `import`** — there is no bundler in the browser to
resolve one. Components are available by name from a fixed scope
([`src/components/mdx.tsx`](../src/components/mdx.tsx)); add to that file to widen
what authors can use.

#### How a discussion gets its URL

```
/content  /  announcements  /  my-post
    │             │                │
    │             │                ├─ the `slug:` field, if present
    │             │                └─ otherwise the discussion number
    │             └─ the category's slug on GitHub
    └─ `discussions.basePath`, configurable
```

A discussion with no metadata at all still has a URL — `/content/announcements/11`
— because the number always exists, is unique, and never changes even if you
rename the discussion. A `slug` gives a readable URL, at the cost that editing it
later breaks the old one (use a `routes` redirect if that happens).

#### What is never published

| | why |
|---|---|
| Discussions by non-collaborators | bodies are compiled as MDX, which evaluates JavaScript in the reader's browser. Only `OWNER`, `MEMBER` and `COLLABORATOR` are rendered — `author_association` comes from GitHub, so a visitor cannot forge it |
| giscus comment threads | identified by the `<!-- sha1: … -->` marker giscus embeds, so content and comments can share a category |
| Discussions labelled `draft` | configurable via `discussions.draftLabel` |

### Choosing between them

| | committed `.mdx` | Discussion |
|---|---|---|
| publishing | push + build (~40s) | instant |
| local preview before publishing | yes | no |
| in the initial HTML / indexed without JS | yes | no |
| HTTP status | 200 | 404 (the Pages fallback) |
| client JavaScript | none | ~227 KB gzip, mostly the MDX compiler |
| `import` in the body | yes | no |
| edit history, comments, reactions on the source | via git | built in |

Use files for anything you want indexed and fast. Use discussions for anything
you want to publish now, or want to write from a phone.

---

## Publishing

### GitHub Pages

The default. [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)
builds and publishes on every push to `main`, and needs **no token** — the build
reads only public endpoints.

```js
// astro.config.mjs
site: 'https://you.github.io',
// no `base` — the shipped default is a root deploy, which is what a user or
// organisation page, a custom domain and Vercel all need
```

A Pages **project** page (`you.github.io/your-repo`) is the exception: add
`base: '/your-repo'`.

Then set **Settings → Pages → Source** to **GitHub Actions**.

Two things that bite:

**`public/.nojekyll` must exist.** GitHub Pages runs branch deploys through
Jekyll, which drops every top-level path starting with an underscore — including
Astro's `_astro/`. Without the file, pages return 200 while every stylesheet and
script 404s. Note `.nojekyll` is a *GitHub Pages* convention: Jekyll itself
ignores it, which is why `pnpm preview:pages` checks for the file rather than
handing the directory to Jekyll.

**`404.html` is load-bearing.** It is what resolves discussion-backed pages.
GitHub Pages serves it for any path with no file, which is exactly the hook this
needs. Do not replace it with a static error page.

### Vercel

Works unchanged, since the shipped config already deploys from the root. Only
the origin needs updating:

```js
site: 'https://your-domain.com',
```

If you had added a `base` for a Pages project page, remove it. `base` is
compiled into every asset URL. A build made for a Pages project site
(`/repo`) 404s every stylesheet and script when served from a web root, while the
pages themselves still return 200 — so it looks like it works. Measured over the
same `dist/`:

| a build made for one, served by the other | pages | assets |
|---|---|---|
| built for `/repo`, served at the root | 200 | **404** |
| built for the root, served under `/repo` | 200 | **404** |

[`vercel.json`](../vercel.json) carries `trailingSlash`, which must agree with
`build.format` in astro.config.mjs — giscus pairs committed pages on the exact
pathname, so a disagreement orphans existing comment threads.

Vercel's SPA fallback is configured through `rewrites` rather than `404.html`.

### Previewing either

```bash
pnpm preview:pages     # serves dist/ the way GitHub Pages does
pnpm preview:vercel    # serves dist/ the way Vercel does
pnpm preview:down
```

These preview the **built** site under each host's semantics — base paths,
trailing slashes, directory indexes, 404 routing. `pnpm dev` remains what you
want while writing.

---

## Formatting and styling

### GitHub Flavoured Markdown

Enabled on both paths: tables, strikethrough, task lists, autolinks and footnotes.

```markdown
| feature | works |
|---|---|
| tables | yes |

~~strikethrough~~

- [x] task lists
```

Astro enables GFM by default for committed files; the browser compiler needs
`remark-gfm` explicitly, which
[`DiscussionPage.tsx`](../src/components/DiscussionPage.tsx) passes. Without it a
table written in GitHub's editor renders as literal pipe characters — worth
knowing if you add another rendering path.

Two GitHub behaviours that do **not** carry over, because they are features of
github.com rather than of Markdown: `@mentions` and `#123` issue references
render as plain text, and GitHub's emoji shortcodes (`:tada:`) are not expanded.
Paste the emoji directly.

### Primer components

In a committed file, import anything:

```mdx
import { Card, Grid, Timeline } from '@primer/react-brand';
```

In a discussion body, use what the fixed scope provides — currently `Box`,
`Heading`, `InlineLink`, `Label`, `Stack`, `Text`, `Timeline`, `Token`. Widen it
by editing [`src/components/mdx.tsx`](../src/components/mdx.tsx).

Prefer presentational components. Anything stateful becomes an island and ships
JavaScript to every page that uses it. The
[Primer Brand docs](https://primer.style/brand/components) list all 55.

Remember the compound-component rule: `Hero`, `Card` and friends must be composed
inside a `.tsx`, never assembled from `.astro`.

### Using Primer's product UI alongside Brand

`@primer/react-brand` and `@primer/react` are different libraries. Brand is the
marketing/editorial system this template is built on; **product UI** is the one
that looks like github.com's application — `DataTable`, `ActionList`,
`TreeView`, `Dialog`. They coexist on the same page, which is worth knowing if a
post needs a real data table rather than a styled one.

Their token namespaces do not collide (`--brand-*` against `--fgColor-*` /
`--bgColor-*`), and the one attribute they share, `data-color-mode`, is read
compatibly by both.

Four steps, none of them obvious:

**1. Install both packages directly.**

```bash
pnpm add @primer/react @primer/primitives
```

`@primer/primitives` arrives as a transitive dependency of `@primer/react`, but
pnpm's strict layout keeps it out of the top level, so an import fails unless it
is declared.

**2. Import the token themes** in any page or layout using product UI:

```astro
import '@primer/primitives/dist/css/functional/themes/light.css';
import '@primer/primitives/dist/css/functional/themes/dark.css';
```

Skip this and `--fgColor-*` / `--bgColor-*` are never defined: components render
with unresolved variables and no colour at all. This is the failure that looks
like the library is broken.

**3. Add it to Vite's `noExternal`** in `src/lib/integration.ts`:

```ts
noExternal: ['@primer/react-brand', '@primer/react'],
```

Both libraries import their own stylesheets as side effects. Left external,
Node's SSR loader reaches those `.css` files directly and the build dies with
`Unknown file extension ".css"`.

**4. The theme attributes are already set.** `src/layouts/Base.astro` carries
`data-light-theme` and `data-dark-theme` alongside `data-color-mode`. Product UI
resolves its tokens from those two whenever the colour mode is `auto`; Brand
ignores them. They ship inert so this step is already done.

Cost, measured: about +36 KB gzipped CSS on pages that use product UI, scoped to
those pages rather than the shared bundle. The `@primer/primitives` package is
large on disk (~56 MB) because it ships every theme variant, which is why it is
not a default dependency here.

### Element mapping

Markdown elements are mapped to Primer components in
[`src/components/mdx.tsx`](../src/components/mdx.tsx) — headings become `Heading`,
paragraphs `Text`, links `InlineLink` with `rel="noopener noreferrer"` on external
targets. Change the mapping there and it applies to every page from both sources
at once.

### Theming

Set once, in [`src/layouts/Base.astro`](../src/layouts/Base.astro):

```astro
<body data-color-mode={colorMode}>
```

`auto` follows the reader's OS; `light` and `dark` force one. Everything derives
from that attribute — there is no theme context to provide and no island to
hydrate.

To add a dark-mode toggle you need a small client-side script that flips the
attribute; a React island is unnecessary, and would be a heavy way to set one
string.

giscus reads its own theme separately, defaulting to `preferred_color_scheme` so
the widget follows the OS alongside the page.

### Custom CSS

[`src/styles/octopage.css`](../src/styles/octopage.css) holds layout only. Keep
every value a `--brand-*` token:

```css
.octopage-main {
  max-width: 1012px;
  padding-inline: var(--base-size-24);
  background-color: var(--brand-color-canvas-default);
}
```

Hard-coding a colour or a font size is how a Primer Brand site quietly becomes a
site that merely resembles one, and it breaks dark mode first.
