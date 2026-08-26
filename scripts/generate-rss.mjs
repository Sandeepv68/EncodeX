import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const blogDir = join(__dirname, '..', 'site', 'blog', 'releases');
const outputFile = join(__dirname, '..', 'site', 'public', 'feed.xml');

const SITE_URL = 'https://encodex.in';

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const meta = {};
  const lines = match[1].split(/\r?\n/);
  let currentKey = '';
  for (const line of lines) {
    const kv = line.match(/^([\w][\w-]*):\s*(.*)/);
    if (kv) {
      currentKey = kv[1];
      const val = kv[2].replace(/^["']|["']$/g, '').trim();
      if (val) {
        meta[currentKey] = val;
      } else {
        meta[currentKey] = [];
      }
    } else if (currentKey && line.match(/^\s+- (.*)/)) {
      const arr = meta[currentKey];
      if (Array.isArray(arr)) {
        arr.push(
          line
            .match(/^\s+- (.*)/)[1]
            .replace(/^["']|["']$/g, '')
            .trim(),
        );
      }
    }
  }
  return meta;
}

let files;
try {
  files = readdirSync(blogDir).filter((f) => f.endsWith('.md'));
} catch {
  console.error('Could not read blog directory');
  process.exit(1);
}

const posts = [];
for (const file of files) {
  const content = readFileSync(join(blogDir, file), 'utf-8');
  const meta = parseFrontmatter(content);
  if (!meta) continue;
  const slug = file.replace(/\.md$/, '');
  posts.push({
    title: String(meta.title || slug),
    date: String(meta.date || ''),
    description: String(meta.description || ''),
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    slug,
    url: `${SITE_URL}/blog/releases/${slug}`,
  });
}

posts.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));

const now = new Date().toUTCString();

const items = posts
  .map(
    (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${post.url}</link>
      <guid isPermaLink="true">${post.url}</guid>
      <description>${escapeXml(post.description)}</description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      ${post.tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join('\n      ')}
    </item>`,
  )
  .join('\n');

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>EncodeX Blog</title>
    <link>${SITE_URL}/blog/</link>
    <description>Release announcements, guides, and updates about EncodeX — the free, open-source video converter.</description>
    <language>en</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

writeFileSync(outputFile, rss, 'utf-8');
console.log(`RSS feed generated: ${outputFile} (${posts.length} posts)`);

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
