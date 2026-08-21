#!/usr/bin/env node

/**
 * Generates blog posts from GitHub Releases.
 *
 * Usage:
 *   node scripts/generate-blog.mjs
 *
 * Requires GITHUB_TOKEN env var for authenticated requests (avoids rate limits).
 * Falls back to unauthenticated requests for public repos (60 req/hr limit).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = 'Sandeepv68/EncodeX';
const BLOG_DIR = join(__dirname, '..', 'site', 'blog', 'releases');
const REPO_URL = `https://api.github.com/repos/${REPO}/releases`;

async function fetchReleases() {
  const token = process.env.GITHUB_TOKEN;
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'EncodeX-Blog-Generator',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(REPO_URL, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch releases: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function slugify(tag) {
  return tag.replace(/^v/, '').replace(/[^a-zA-Z0-9.-]/g, '-');
}

function formatDate(dateStr) {
  return new Date(dateStr).toISOString().split('T')[0];
}

function generatePost(release) {
  const date = formatDate(release.published_at || release.created_at);
  const tag = release.tag_name;
  const name = release.name || tag;
  const body = release.body || 'No release notes provided.';

  return `---
date: ${date}
title: "${name.replace(/"/g, '\\"')}"
tags:
  - release
  - ${slugify(tag)}
---

# ${name}

**Released:** ${date}
**Tag:** [\`${tag}\`](https://github.com/${REPO}/releases/tag/${tag})

${body}

---

[View on GitHub](https://github.com/${REPO}/releases/tag/${tag})
`;
}

async function main() {
  console.log(`[generate-blog] Fetching releases from ${REPO}...`);
  const releases = await fetchReleases();

  mkdirSync(BLOG_DIR, { recursive: true });

  let count = 0;
  for (const release of releases) {
    if (release.draft) continue;

    const slug = slugify(release.tag_name);
    const filename = join(BLOG_DIR, `${slug}.md`);
    const content = generatePost(release);
    writeFileSync(filename, content, 'utf-8');
    console.log(`[generate-blog] Wrote ${filename}`);
    count++;
  }

  console.log(`[generate-blog] Done. Generated ${count} blog posts.`);
}

main().catch((err) => {
  console.error('[generate-blog] Error:', err.message);
  process.exit(1);
});
