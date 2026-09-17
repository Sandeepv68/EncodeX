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
import { readdirSync, renameSync, statSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'site', '.vitepress', 'dist');

const KEEP_AS_FILE = new Set(['index.html', '404.html']);

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

  console.log(`\nDone: moved ${moved} pages, skipped ${skipped}.`);

  const rootFiles = readdirSync(distDir).filter((f) => f.endsWith('.html'));
  console.log(`Root html remaining (should only be index.html + 404.html): ${rootFiles.join(', ') || '(none)'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
