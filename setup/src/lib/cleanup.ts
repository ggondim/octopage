import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Remove the setup from the project it just configured.
 *
 * A template repository becomes the user's own repository the moment they run
 * this, and a setup wizard sitting in the root of a personal site is clutter
 * that will never be run again. Removing it — and the dependencies only it
 * needed — leaves a project that looks like it was always meant to be this way.
 */
export interface CleanupResult {
  removed: string[];
  keptBecause?: string;
}

const SETUP_ONLY_DEPS = ['ink', 'ink-select-input', 'ink-text-input', '@inkjs/ui', 'tsx'];

export async function selfDestruct(root: string): Promise<CleanupResult> {
  const removed: string[] = [];

  const pkgPath = join(root, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));

  delete pkg.scripts?.setup;

  for (const dep of SETUP_ONLY_DEPS) {
    if (pkg.devDependencies?.[dep]) {
      delete pkg.devDependencies[dep];
      removed.push(dep);
    }
  }

  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

  // Last, so a failure above leaves the wizard runnable rather than stranding
  // the project half-configured with no way to retry.
  await rm(join(root, 'setup'), { recursive: true, force: true });
  removed.push('setup/');

  return { removed };
}
