/**
 * Static server for the built site, used by two callers.
 *
 * The Docker `vercel` profile runs it to preview how Vercel serves `dist/` —
 * from the web root, applying the parts of vercel.json that change which file a
 * URL resolves to (`trailingSlash`, `cleanUrls`).
 *
 * The Playwright suite runs it with `BASE_PATH` set, to serve the site the way
 * GitHub Pages does. `astro preview` cannot do that job: as of Astro 7 it
 * daemonises and the foreground process exits, so Playwright's `webServer`
 * sees it die immediately.
 *
 * `vercel dev` is the faithful thing, but it refuses to start without
 * credentials, which makes it useless as the default preview for a template
 * repo. This covers the failure this profile actually exists to catch — a site
 * built for a GitHub Pages base path being served from the web root — without
 * asking anyone to log in. Set VERCEL_TOKEN to get the real thing instead.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const ROOT = process.env.SERVE_ROOT ?? '/repo/dist';
const PORT = Number(process.env.PORT ?? 3000);

// Deploy base path, e.g. '/octopage'. Stripped before resolving, which is what
// makes a base-path mistake reachable from a test instead of only after a
// deploy to a project page.
const BASE = (process.env.BASE_PATH ?? '').replace(/\/$/, '');

const config = JSON.parse(await readFile(process.env.VERCEL_JSON ?? '/repo/vercel.json', 'utf8'));
const trailingSlash = config.trailingSlash === true;
const cleanUrls = config.cleanUrls === true;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.xml': 'application/xml', '.ico': 'image/x-icon',
};

const isFile = (p) => existsSync(p) && statSync(p).isFile();

function resolve(pathname) {
  // Reject traversal before touching the filesystem.
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const direct = join(ROOT, safe);

  if (isFile(direct)) return { file: direct };

  const index = join(direct, 'index.html');
  if (isFile(index)) {
    // Vercel redirects to the canonical form rather than serving both.
    if (trailingSlash && !safe.endsWith('/')) return { redirect: `${safe}/` };
    if (!trailingSlash && safe.endsWith('/') && safe !== '/') return { redirect: safe.replace(/\/$/, '') };
    return { file: index };
  }

  if (cleanUrls && isFile(`${direct}.html`)) return { file: `${direct}.html` };

  return { notFound: true };
}

createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (BASE && !pathname.startsWith(`${BASE}/`) && pathname !== BASE) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end(`404 — this site is served under ${BASE}/`);
  }

  const result = resolve(BASE ? pathname.slice(BASE.length) || '/' : pathname);

  if (result.redirect) {
    res.writeHead(308, { Location: `${BASE}${result.redirect}` });
    return res.end();
  }

  if (result.notFound) {
    const custom = join(ROOT, '404.html');
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    return isFile(custom) ? createReadStream(custom).pipe(res) : res.end('404');
  }

  res.writeHead(200, { 'Content-Type': TYPES[extname(result.file)] ?? 'application/octet-stream' });
  createReadStream(result.file).pipe(res);
}).listen(PORT, '0.0.0.0', () => {
  console.log(
    `serving ${ROOT} on :${PORT}${BASE || '/'}  (trailingSlash=${trailingSlash}, cleanUrls=${cleanUrls})`,
  );
});
