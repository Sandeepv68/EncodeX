export interface ReleaseAsset {
  key: string;
  name: string;
  url: string;
  size: number;
  sha256: string | null;
  downloads: number;
}

export interface ReleaseData {
  tag: string;
  version: string;
  name: string;
  publishedAt: string;
  htmlUrl: string;
  prerelease: boolean;
  assets: Record<string, ReleaseAsset>;
  fetchedAt: string;
}

import packageJson from '../../../package.json';

export const REPO = 'Sandeepv68/EncodeX';

export const PRODUCT_NAME = 'EncodeX';
export const APP_VERSION: string = (packageJson as { version?: string }).version || '0.0.0';

// GitHub always resolves this host-relative path to whatever the current
// "latest" release asset is, so a link built from it keeps working between
// releases and never needs an API round-trip. It is the last line of defence
// when the API is unavailable at build time AND at runtime.
export const LATEST_DOWNLOAD_BASE = `https://github.com/${REPO}/releases/latest/download`;

// Mirror of the electron-builder `artifactName` templates in package.json so
// the deterministic fallback names exactly match the real asset names.
const FALLBACK_ASSET_NAMES: Record<string, string> = {
  'win-x64': `${PRODUCT_NAME}-${APP_VERSION}-x64-setup.exe`,
  'win-ia32': `${PRODUCT_NAME}-${APP_VERSION}-ia32-setup.exe`,
  'win-arm64': `${PRODUCT_NAME}-${APP_VERSION}-arm64-setup.exe`,
  'mac-arm64': `${PRODUCT_NAME}-${APP_VERSION}-arm64.dmg`,
  'mac-x64': `${PRODUCT_NAME}-${APP_VERSION}-x64.dmg`,
  'linux-x86_64': `${PRODUCT_NAME}-${APP_VERSION}-x86_64.AppImage`,
  'linux-arm64': `${PRODUCT_NAME}-${APP_VERSION}-arm64.AppImage`,
  'linux-armv7l': `${PRODUCT_NAME}-${APP_VERSION}-armv7l.AppImage`,
};

/**
 * A release snapshot that needs no network at all: every download URL points
 * at GitHub's `releases/latest/download/<asset>` redirect. Size, checksum and
 * download counts are unknown (zero) and are simply not rendered until a real
 * API response upgrades them.
 * @returns {ReleaseData}
 */
export function buildFallbackRelease(): ReleaseData {
  const assets: Record<string, ReleaseAsset> = {};
  for (const [key, name] of Object.entries(FALLBACK_ASSET_NAMES)) {
    assets[key] = {
      key,
      name,
      url: `${LATEST_DOWNLOAD_BASE}/${name}`,
      size: 0,
      sha256: null,
      downloads: 0,
    };
  }
  return {
    tag: `v${APP_VERSION}`,
    version: APP_VERSION,
    name: `${PRODUCT_NAME} ${APP_VERSION}`,
    publishedAt: '',
    htmlUrl: `https://github.com/${REPO}/releases`,
    prerelease: true,
    assets,
    fetchedAt: new Date().toISOString(),
  };
}

const ARTIFACT_PATTERNS: Array<[RegExp, string]> = [
  [/^EncodeX-[\w.+~-]+-x64-setup\.exe$/, 'win-x64'],
  [/^EncodeX-[\w.+~-]+-ia32-setup\.exe$/, 'win-ia32'],
  [/^EncodeX-[\w.+~-]+-arm64-setup\.exe$/, 'win-arm64'],
  [/^EncodeX-[\w.+~-]+-arm64\.dmg$/, 'mac-arm64'],
  [/^EncodeX-[\w.+~-]+-x64\.dmg$/, 'mac-x64'],
  [/^EncodeX-[\w.+~-]+-x86_64\.AppImage$/, 'linux-x86_64'],
  [/^EncodeX-[\w.+~-]+-arm64\.AppImage$/, 'linux-arm64'],
  [/^EncodeX-[\w.+~-]+-armv7l\.AppImage$/, 'linux-armv7l'],
];

interface GitHubAsset {
  name: string;
  size: number;
  download_count?: number;
  digest?: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string | null;
  published_at: string;
  html_url: string;
  prerelease?: boolean;
  draft?: boolean;
  assets: GitHubAsset[];
}

function compareVersions(left: string, right: string): number {
  const parse = (version: string) => {
    const [core = '', ...pre] = version.replace(/^v/, '').split('-');
    return {
      core: core.split('.').map((part) => Number.parseInt(part, 10) || 0),
      pre: pre.join('-').split('.').filter(Boolean),
    };
  };
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    const aPart = a.core[index] ?? 0;
    const bPart = b.core[index] ?? 0;
    if (aPart !== bPart) return aPart - bPart;
  }
  if (a.pre.length === 0 || b.pre.length === 0) {
    if (a.pre.length === b.pre.length) return 0;
    return a.pre.length === 0 ? 1 : -1;
  }
  for (let index = 0; index < Math.max(a.pre.length, b.pre.length); index += 1) {
    const aPart = a.pre[index];
    const bPart = b.pre[index];
    if (aPart === undefined) return -1;
    if (bPart === undefined) return 1;
    if (aPart === bPart) continue;
    const aNumeric = /^\d+$/.test(aPart);
    const bNumeric = /^\d+$/.test(bPart);
    if (aNumeric && bNumeric) return Number(aPart) - Number(bPart);
    if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
    return aPart.localeCompare(bPart);
  }
  return 0;
}

function compareReleasesDescending(a: ReleaseData, b: ReleaseData): number {
  const versionDifference = compareVersions(a.version, b.version);
  if (versionDifference !== 0) return -versionDifference;
  return b.publishedAt.localeCompare(a.publishedAt);
}

export function normalizeRelease(release: GitHubRelease, fetchedAt: string): ReleaseData {
  const assets: Record<string, ReleaseAsset> = {};
  for (const asset of release.assets) {
    const match = ARTIFACT_PATTERNS.find(([pattern]) => pattern.test(asset.name));
    if (!match) continue;
    assets[match[1]] = {
      key: match[1],
      name: asset.name,
      url: asset.browser_download_url,
      size: asset.size,
      sha256: asset.digest?.startsWith('sha256:') ? asset.digest.slice('sha256:'.length) : null,
      downloads: Math.max(0, asset.download_count ?? 0),
    };
  }
  return {
    tag: release.tag_name,
    version: release.tag_name.replace(/^v/, ''),
    name: release.name || release.tag_name,
    publishedAt: release.published_at,
    htmlUrl: release.html_url,
    prerelease: release.prerelease === true,
    assets,
    fetchedAt,
  };
}

export function totalDownloads(release: ReleaseData): number {
  return Object.values(release.assets).reduce((sum, asset) => sum + asset.downloads, 0);
}

export interface RepoStats {
  stars: number;
  forks: number;
  clones: number;
  fetchedAt: string;
}

export async function fetchRepoStats(): Promise<RepoStats> {
  const res = await fetch(`https://api.github.com/repos/${REPO}`, {
    headers: apiHeaders(),
  });
  if (!res.ok) {
    throw new Error(`GitHub API responded ${res.status} while fetching repo stats`);
  }
  const data = (await res.json()) as { stargazers_count?: number; forks_count?: number };
  return {
    stars: Math.max(0, data.stargazers_count ?? 0),
    forks: Math.max(0, data.forks_count ?? 0),
    clones: await fetchCloneStats(),
    fetchedAt: new Date().toISOString(),
  };
}

// GitHub exposes clone counts only via the /traffic/clones endpoint (last 14 days).
// It requires an authenticated request with push access, so without a GITHUB_TOKEN
// we skip it silently and failures just hide the pill.
async function fetchCloneStats(): Promise<number> {
  const hasToken = typeof process !== 'undefined' && Boolean(process.env?.GITHUB_TOKEN);
  if (!hasToken) return 0;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/traffic/clones`, {
      headers: apiHeaders(),
    });
    if (!res.ok) {
      throw new Error(`GitHub API responded ${res.status} while fetching clone stats`);
    }
    const data = (await res.json()) as { count?: number };
    return Math.max(0, data.count ?? 0);
  } catch (error) {
    console.warn('[clone stats] Could not fetch clone counts; the count will stay hidden.', error instanceof Error ? error.message : error);
    return 0;
  }
}

function apiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'encodex-site',
  };
  if (typeof process !== 'undefined' && process.env?.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

export async function fetchLatestRelease(): Promise<ReleaseData> {
  // Uses the releases list instead of `/releases/latest`, which returns 404
  // when every release is marked prerelease (common for beta products).
  const releases = await fetchReleases(100);
  const first = releases[0];
  if (!first) {
    throw new Error('GitHub returned no published releases');
  }
  return first;
}

export async function fetchReleases(perPage = 100): Promise<ReleaseData[]> {
  const all: GitHubRelease[] = [];
  const maxPages = 10;
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=${perPage}&page=${page}`, { headers: apiHeaders() });
    if (!res.ok) {
      throw new Error(`GitHub API responded ${res.status} while fetching releases`);
    }
    const list = (await res.json()) as GitHubRelease[];
    all.push(...list);
    if (list.length < perPage) break;
  }
  const now = new Date().toISOString();
  return all
    .filter((rel) => !rel.draft)
    .map((rel) => normalizeRelease(rel, now))
    .sort(compareReleasesDescending);
}

// Memoized so every caller shares one set of API requests
let releasesPromise: Promise<ReleaseData[]> | null = null;

export function getReleases(): Promise<ReleaseData[]> {
  if (!releasesPromise) {
    releasesPromise = fetchReleases().catch((error) => {
      releasesPromise = null;
      throw error;
    });
  }
  return releasesPromise;
}

// Memoized repo stats so every caller shares one API request
let statsPromise: Promise<RepoStats> | null = null;

export function getRepoStats(): Promise<RepoStats> {
  if (!statsPromise) {
    statsPromise = fetchRepoStats().catch((error) => {
      statsPromise = null;
      throw error;
    });
  }
  return statsPromise;
}

// Subscriber pattern — components register to be notified when data refreshes
type ReleaseCallback = (releases: ReleaseData[]) => void;
const listeners = new Set<ReleaseCallback>();

export function onReleasesUpdated(cb: ReleaseCallback): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

type StatsCallback = (stats: RepoStats) => void;
const statsListeners = new Set<StatsCallback>();

export function onStatsUpdated(cb: StatsCallback): () => void {
  statsListeners.add(cb);
  return () => {
    statsListeners.delete(cb);
  };
}

// Singleton poll — at most one timer across all component instances
const POLL_MS = 60_000;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let polling = false;

export function startReleasePolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    if (polling) return;
    polling = true;
    try {
      releasesPromise = null;
      const releases = await getReleases();
      for (const cb of listeners) cb(releases);
      try {
        statsPromise = null;
        const stats = await getRepoStats();
        for (const cb of statsListeners) cb(stats);
      } catch {
        // transient repo-stats refresh errors are non-fatal
      }
    } finally {
      polling = false;
    }
  }, POLL_MS);
}

export function stopReleasePolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
