import fs from 'node:fs';
import path from 'node:path';

const SITE = path.resolve('site');
const SITE_URL = 'https://encodex.in';
const LOCALES = ['de', 'es', 'fr', 'hi', 'pt', 'zh'];

// EN page → ogImage mapping (absolute URLs)
const ogImageMap = {
  'video-converter.md': `${SITE_URL}/images/convert.webp`,
  'video-compressor.md': `${SITE_URL}/images/convert.webp`,
  'audio-converter.md': `${SITE_URL}/images/extract_audio.webp`,
  'extract-audio-from-video.md': `${SITE_URL}/images/extract_audio.webp`,
  'ffmpeg-gui.md': `${SITE_URL}/images/home_dashboard.webp`,
  'download.md': `${SITE_URL}/images/home_dashboard.webp`,
  'handbrake-alternative.md': `${SITE_URL}/images/convert.webp`,
  'cli.md': `${SITE_URL}/images/home_dashboard.webp`,
  'convert/mkv-to-mp4.md': `${SITE_URL}/images/convert.webp`,
  'convert/mov-to-mp4.md': `${SITE_URL}/images/convert.webp`,
  'convert/avi-to-mp4.md': `${SITE_URL}/images/convert.webp`,
  'convert/flv-to-mp4.md': `${SITE_URL}/images/convert.webp`,
  'convert/wmv-to-mp4.md': `${SITE_URL}/images/convert.webp`,
  'convert/m4v-to-mp4.md': `${SITE_URL}/images/convert.webp`,
  'convert/webm-to-mp4.md': `${SITE_URL}/images/convert.webp`,
  'convert/mp4-to-mkv.md': `${SITE_URL}/images/convert.webp`,
  'convert/mp4-to-webm.md': `${SITE_URL}/images/convert.webp`,
  'codecs/h264.md': `${SITE_URL}/images/home_dashboard.webp`,
  'codecs/h265.md': `${SITE_URL}/images/home_dashboard.webp`,
  'codecs/av1.md': `${SITE_URL}/images/home_dashboard.webp`,
  'codecs/vp9.md': `${SITE_URL}/images/home_dashboard.webp`,
  'codecs/prores.md': `${SITE_URL}/images/home_dashboard.webp`,
  'compress/mp4.md': `${SITE_URL}/images/convert.webp`,
  'compress/mkv.md': `${SITE_URL}/images/convert.webp`,
  'extract/mp3-from-video.md': `${SITE_URL}/images/extract_audio.webp`,
  'extract/wav-from-video.md': `${SITE_URL}/images/extract_audio.webp`,
  'platforms/windows.md': `${SITE_URL}/images/home_dashboard.webp`,
  'platforms/mac.md': `${SITE_URL}/images/home_dashboard.webp`,
  'platforms/linux.md': `${SITE_URL}/images/home_dashboard.webp`,
};

function addOgImage(filePath, ogImage) {
  const content = fs.readFileSync(filePath, 'utf8');
  const hasRelative = content.includes('ogImage: "/images/');
  if (content.includes('ogImage:') && !hasRelative) return false; // already absolute

  // Find frontmatter end (handles \r\n and \n)
  const fmMatch = content.match(/\r?\n---\r?\n/);
  if (!fmMatch) return false;

  const fmEnd = content.indexOf(fmMatch[0]);
  const eol = fmMatch[0].startsWith('\r\n') ? '\r\n' : '\n';

  let newContent;
  if (hasRelative) {
    // Replace existing relative ogImage with absolute
    newContent = content.replace(/ogImage: "\/images\/[^"]+"/, `ogImage: "${ogImage}"`);
  } else {
    const before = content.slice(0, fmEnd);
    const after = content.slice(fmEnd);
    newContent = `${before}${eol}ogImage: "${ogImage}"${after}`;
  }

  fs.writeFileSync(filePath, newContent, 'utf8');
  return true;
}

let count = 0;

// Process EN pages
for (const [rel, ogImage] of Object.entries(ogImageMap)) {
  const filePath = path.join(SITE, rel);
  if (fs.existsSync(filePath) && addOgImage(filePath, ogImage)) {
    count++;
  }
}

// Process locale mirrors
for (const locale of LOCALES) {
  for (const [rel, ogImage] of Object.entries(ogImageMap)) {
    const filePath = path.join(SITE, 'locales', locale, rel);
    if (fs.existsSync(filePath) && addOgImage(filePath, ogImage)) {
      count++;
    }
  }
}

console.log(`Added ogImage frontmatter to ${count} files`);
