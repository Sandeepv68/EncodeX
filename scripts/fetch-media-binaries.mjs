/**
 * Stages the correct-architecture ffmpeg and ffprobe binaries for packaging.
 *
 * ffmpeg-static only ships a binary for the machine it was installed on, and
 * ffprobe-static only ships binaries for a subset of platforms/arches. For a
 * release job building a different target (e.g. a linux arm64 AppImage built on
 * an x64 runner) this script downloads the matching ffmpeg/ffprobe pair from
 * the ffmpeg-static GitHub release and drops them into `node_modules`, exactly
 * where the `extraResources` entries in package.json expect them:
 *   - ffmpeg:  <node_modules>/ffmpeg-static/ffmpeg[.exe]
 *   - ffprobe: <node_modules>/ffprobe-static/bin/<platform>/<arch>/ffprobe[.exe]
 *
 * Native builds are skipped: `npm ci` already installed the correct binaries.
 *
 * Usage:
 *   node scripts/fetch-media-binaries.mjs [--platform=linux] [--arch=arm64]
 *
 * `--platform` accepts the release matrix names (`windows`, `macos`, `ubuntu`)
 * or the Node names (`win32`, `darwin`, `linux`); `--arch` accepts
 * electron-builder names (`x64`, `ia32`, `arm64`, `armv7l`) or Node names
 * (`x64`, `ia32`, `arm64`, `arm`). Both default to the host platform/arch.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { gunzipSync } from 'zlib';
import { fileURLToPath } from 'url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

const EXECUTABLES = ['ffmpeg', 'ffprobe'];

function fail(message) {
  console.error(`[fetch-media-binaries] ERROR: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { platform: process.platform, arch: process.arch };
  for (const raw of argv) {
    const match = /^--(platform|arch)=(.+)$/.exec(raw);
    if (match) args[match[1]] = match[2];
  }
  args.platform = normalizePlatform(args.platform);
  args.arch = normalizeArch(args.arch);
  return args;
}

function normalizePlatform(platform) {
  switch (platform) {
    case 'windows':
      return 'win32';
    case 'macos':
    case 'darwin':
      return 'darwin';
    case 'ubuntu':
    case 'linux':
      return 'linux';
    default:
      return platform;
  }
}

function normalizeArch(arch) {
  switch (arch) {
    case 'armv7l':
      return 'arm';
    default:
      return arch;
  }
}

function executableName(platform) {
  return platform === 'win32' ? '.exe' : '';
}

function isNativeBuild(targetPlatform, targetArch) {
  return targetPlatform === normalizePlatform(process.platform) && targetArch === normalizeArch(process.arch);
}

function releaseTag() {
  const pkgPath = join(REPO_ROOT, 'node_modules', 'ffmpeg-static', 'package.json');
  if (!existsSync(pkgPath)) fail(`missing ${pkgPath}; run "npm ci" first`);
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const tag = pkg['ffmpeg-static'] && pkg['ffmpeg-static']['binary-release-tag'];
  if (!tag) fail(`no "binary-release-tag" found in ${pkgPath}`);
  return tag;
}

function writeBinary(destinationPath, bytes) {
  mkdirSync(dirname(destinationPath), { recursive: true });
  writeFileSync(destinationPath, bytes);
  try {
    chmodSync(destinationPath, 0o755);
  } catch {
    // chmod is a no-op on Windows.
  }
}

function releaseUrl(executable, platform, arch, tag) {
  return `https://github.com/eugeneware/ffmpeg-static/releases/download/${tag}/${executable}-${platform}-${arch}.gz`;
}

async function download(url, destinationPath) {
  console.log(`[fetch-media-binaries] downloading ${url}`);
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`GET ${url} failed with HTTP ${response.status}`);
  const bytes = gunzipSync(Buffer.from(await response.arrayBuffer()));
  writeBinary(destinationPath, bytes);
  console.log(`[fetch-media-binaries] wrote ${destinationPath} (${bytes.length} bytes)`);
}

async function stageExecutable(executable, targetPlatform, targetArch, tag, native) {
  const suffix = executableName(targetPlatform);
  const targetPath =
    executable === 'ffmpeg'
      ? join(REPO_ROOT, 'node_modules', 'ffmpeg-static', `ffmpeg${suffix}`)
      : join(REPO_ROOT, 'node_modules', 'ffprobe-static', 'bin', targetPlatform, targetArch, `ffprobe${suffix}`);

  if (native) {
    console.log(`[fetch-media-binaries] native build; keeping existing ${executable} at ${targetPath}`);
    return;
  }

  const url = releaseUrl(executable, targetPlatform, targetArch, tag);
  try {
    await download(url, targetPath);
    return;
  } catch (err) {
    console.log(`[fetch-media-binaries] no asset at ${url} (${err.message})`);
  }

  // ffprobe-static ships committed binaries for several platforms/arches
  // (e.g. win32 ia32, darwin arm64); keep the matching one if present.
  if (executable === 'ffprobe' && existsSync(targetPath)) {
    console.log(`[fetch-media-binaries] keeping existing ${executable} at ${targetPath}`);
    return;
  }

  // Windows ARM64 (and Windows ia32 for ffmpeg) have no upstream release
  // asset; bundle the win32 x64 binary instead, which runs via Windows-on-ARM
  // emulation. This keeps those installers functional at a performance cost.
  if (targetPlatform === 'win32') {
    console.warn(
      `[fetch-media-binaries] WARNING: no ${executable}-win32-${targetArch} asset; falling back to the win32 x64 binary for ${targetArch}`,
    );
    await download(releaseUrl(executable, 'win32', 'x64', tag), targetPath);
    return;
  }

  fail(`could not obtain ${executable} for ${targetPlatform}/${targetArch}`);
}

async function main() {
  const { platform: targetPlatform, arch: targetArch } = parseArgs(process.argv.slice(2));
  const native = isNativeBuild(targetPlatform, targetArch);
  const tag = releaseTag();
  console.log(
    `[fetch-media-binaries] target=${targetPlatform}/${targetArch} host=${process.platform}/${process.arch} release=${tag} native=${native}`,
  );

  for (const executable of EXECUTABLES) {
    await stageExecutable(executable, targetPlatform, targetArch, tag, native);
  }
  console.log('[fetch-media-binaries] done');
}

await main();
