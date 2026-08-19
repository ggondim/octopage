import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface Answers {
  title: string;
  description: string;
  /** Absolute origin, e.g. https://you.github.io */
  siteUrl: string;
  /** '/repo' for a project page, '/' for a user site, custom domain or Vercel. */
  base: string;
  /** Category holding comment threads. Empty means "let the build derive it". */
  commentsCategory: string;
}

/**
 * Setup writes to the files that already own each fact rather than inventing a
 * config to restate them: the site's name and tagline belong to package.json,
 * its URL and base path to astro.config.mjs. Only the comment category, which
 * neither of those knows about, goes into octopage.config.ts.
 */
export async function applyAnswers(root: string, answers: Answers): Promise<string[]> {
  const touched: string[] = [];

  const pkgPath = join(root, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  pkg.name = answers.title;
  pkg.description = answers.description;
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  touched.push('package.json');

  const astroPath = join(root, 'astro.config.mjs');
  let astro = await readFile(astroPath, 'utf8');
  astro = astro.replace(/site:\s*'[^']*'/, `site: '${answers.siteUrl}'`);
  astro =
    answers.base === '/' || answers.base === ''
      ? astro.replace(/\n\s*base:\s*'[^']*',/, '')
      : astro.replace(/base:\s*'[^']*'/, `base: '${answers.base}'`);
  await writeFile(astroPath, astro, 'utf8');
  touched.push('astro.config.mjs');

  if (answers.commentsCategory) {
    const configPath = join(root, 'octopage.config.ts');
    const config = await readFile(configPath, 'utf8');
    await writeFile(
      configPath,
      config.replace(/\/\/ comments: '[^']*',/, `comments: '${answers.commentsCategory}',`),
      'utf8',
    );
    touched.push('octopage.config.ts');
  }

  return touched;
}
