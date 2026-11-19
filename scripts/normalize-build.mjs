/**
 * Normalizes the VitePress build output for GitHub Pages.
 *
 * VitePress with `cleanUrls: true` emits flat `.html` files (e.g. `video-converter.html`).
 * On GitHub Pages this means a page is reachable BOTH as `/video-converter` (extensionless
 * fallback) AND `/video-converter.html`, producing duplicate, crawlable URLs that break
 * canonical signals. Trailing-slash URLs (`/video-converter/`) 404 entirely.
 *
 * This script converts every `*.html` page into a `<name>/index.html` directory, GitHub
 * Pages' native "pretty URL" format. After conversion:
 *   - `/video-converter/`  -> 200 (canonical)
 *   - `/video-converter`   -> 301 -> `/video-converter/`
 *   - `/video-converter.html` -> 404 (legacy duplicate eliminated)
 *
 * The sitemap.xml, canonical tags, hreflang and og:url already use trailing-slash URLs.
 */
import { readdirSync, readFileSync, renameSync, statSync, mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'site', '.vitepress', 'dist');

const KEEP_AS_FILE = new Set(['index.html', '404.html']);
const ANCHOR_HREF = /(<a\b[^>]*?\bhref=")([^"]*)(")/gi;
const ABSOLUTE_SITE_HREF = /^https?:\/\/(?:www\.)?encodex\.in(?=\/|$)/i;
const ASSET_EXTENSIONS = /\.(?:xml|txt|json|webmanifest|ico|png|jpe?g|gif|webp|avif|svg|css|js|mjs|map|woff2?|ttf|otf|eot|pdf|zip|dmg|exe|AppImage|deb|rpm|apk|yml|yaml|html)$/i;

function canonicalizeHref(href) {
  const splitAt = href.search(/[?#]/);
  const target = splitAt === -1 ? href : href.slice(0, splitAt);
  const suffix = splitAt === -1 ? '' : href.slice(splitAt);
  const absolute = ABSOLUTE_SITE_HREF.test(target);

  if (!absolute && (!target.startsWith('/') || target.startsWith('//'))) return href;

  let pathname = absolute ? target.replace(ABSOLUTE_SITE_HREF, '') : target;
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;

  if (pathname === '/' || pathname === '/404' || pathname === '/404/' || ASSET_EXTENSIONS.test(pathname)) {
    return absolute ? `https://encodex.in${pathname}${suffix}` : href;
  }

  const canonicalPath = `${pathname.replace(/\/{2,}/g, '/').replace(/\/+$/, '')}/`;
  return absolute ? `https://encodex.in${canonicalPath}${suffix}` : `${canonicalPath}${suffix}`;
}

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      entries.push(...walk(full));
    } else {
      entries.push(full);
    }
  }
  return entries;
}

async function main() {
  if (!existsSync(distDir)) {
    console.error(`Build output not found: ${distDir}`);
    console.error('Run `npm run docs:build` first.');
    process.exit(1);
  }

  const htmlFiles = walk(distDir).filter((f) => f.endsWith('.html'));
  const toMove = htmlFiles.filter((f) => !KEEP_AS_FILE.has(basename(f)));

  let moved = 0;
  let skipped = 0;

  for (const file of toMove) {
    const pageDir = dirname(file);
    const page = basename(file, '.html');
    const targetDir = join(pageDir, page);
    const targetIndex = join(targetDir, 'index.html');

    if (existsSync(targetIndex)) {
      console.log(`skip (target exists): ${file}`);
      skipped++;
      continue;
    }

    mkdirSync(targetDir, { recursive: true });
    renameSync(file, targetIndex);
    moved++;
    console.log(`moved: ${file.replace(distDir, '')} -> ${targetIndex.replace(distDir, '')}`);
  }

  let rewritten = 0;
  for (const file of walk(distDir).filter((f) => f.endsWith('.html'))) {
    const html = readFileSync(file, 'utf8');
    const normalized = html.replace(ANCHOR_HREF, (match, open, href, close) => {
      const canonical = canonicalizeHref(href);
      return canonical === href ? match : `${open}${canonical}${close}`;
    });
    if (normalized !== html) {
      writeFileSync(file, normalized, 'utf8');
      rewritten++;
    }
  }

  console.log(`\nDone: moved ${moved} pages, skipped ${skipped}.`);
  console.log(`Normalized internal links in ${rewritten} pages.`);

  const rootFiles = readdirSync(distDir).filter((f) => f.endsWith('.html'));
  console.log(`Root html remaining (should only be index.html + 404.html): ${rootFiles.join(', ') || '(none)'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
