import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));
const releaseBase = `https://github.com/Sandeepv68/EncodeX/releases/download/v${version}`;

const URLS = [
  `${releaseBase}/EncodeX-${version}-x64-setup.exe`,
  `${releaseBase}/EncodeX-${version}-arm64-setup.exe`,
  `${releaseBase}/EncodeX-${version}-x64.dmg`,
  `${releaseBase}/EncodeX-${version}-arm64.dmg`,
  `${releaseBase}/EncodeX-${version}-x86_64.AppImage`,
  `${releaseBase}/EncodeX-${version}-arm64.AppImage`,
];

function getRandomUrl() {
  return URLS[Math.floor(Math.random() * URLS.length)];
}

async function makeRequest() {
  const url = getRandomUrl();
  try {
    const response = await fetch(url);
    console.log(`[${new Date().toISOString()}] URL: ${url}`);
    console.log(`[${new Date().toISOString()}] Status: ${response.status}`);

    const reader = response.body.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Request failed:`, error.message);
  }
}

makeRequest();
setInterval(makeRequest, 20_000);
