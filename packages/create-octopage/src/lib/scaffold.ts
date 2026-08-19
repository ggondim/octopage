import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface Answers {
  owner: string;
  name: string;
  source: 'discussions' | 'code';
  title: string;
  description: string;
  url: string;
  base: string;
  contentCategory: string;
  comments:
    | false
    | {
        repoId: string;
        category: string;
        categoryId: string;
      };
}

/** Emit a TS string literal, quotes and backslashes escaped. */
function str(value: string): string {
  return JSON.stringify(value);
}

export function renderConfig(answers: Answers): string {
  const comments =
    answers.comments === false
      ? `  // Comments are off. Set this to the giscus values for your repo to turn
  // them on — https://giscus.app resolves repoId and categoryId for you.
  comments: false,`
      : `  comments: {
    repoId: ${str(answers.comments.repoId)},
    category: ${str(answers.comments.category)},
    categoryId: ${str(answers.comments.categoryId)},
    strict: true,
  },`;

  const sourceNote =
    answers.source === 'discussions'
      ? `  // Discussions are the source of truth. Nothing is committed: the build
  // syncs every discussion in \`contentCategories\` down to MDX before Astro
  // runs. giscus pairs by discussion number.`
      : `  // .mdx files in the repo are the source of truth, so content can be
  // previewed locally before publishing. The build creates the paired
  // discussion for each page; giscus pairs by URL pathname.`;

  return `import { defineConfig } from 'octopage/config';

export default defineConfig({
  site: {
    title: ${str(answers.title)},
    description: ${str(answers.description)},
    url: ${str(answers.url)},
    base: ${str(answers.base)},
  },

  repo: { owner: ${str(answers.owner)}, name: ${str(answers.name)} },

${sourceNote}
  source: ${str(answers.source)},

  discussions: {
    contentCategories: [${str(answers.contentCategory)}],
    draftLabel: 'draft',
    basePath: '/content',
  },

  code: {
    dirs: ['blog', 'pages'],
    createDiscussions: true,
  },

${comments}

  // Point any URL at a specific discussion to build a custom information
  // architecture on top of the generated routes:
  //   routes: { '/about': { discussion: 12 } },
  routes: {},
});
`;
}

export async function writeConfig(root: string, answers: Answers): Promise<string> {
  const path = join(root, 'octopage.config.ts');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, renderConfig(answers), 'utf8');
  return path;
}

/**
 * A first page, so a fresh site is not an empty index.
 *
 * Only written in `code` mode — in `discussions` mode the equivalent gesture
 * would be creating a discussion, and setup deliberately does not publish
 * anything to a public repo on the user's behalf.
 */
export async function writeStarterContent(root: string): Promise<string[]> {
  const post = join(root, 'blog', 'hello.mdx');
  await mkdir(dirname(post), { recursive: true });
  await writeFile(
    post,
    `---
title: Hello
description: The first page of this site.
date: ${new Date().toISOString().slice(0, 10)}
---

Write in MDX. Primer Brand components can be imported and used inline, and
comments arrive from the paired GitHub Discussion once the site is deployed.
`,
    'utf8',
  );
  return [post];
}
