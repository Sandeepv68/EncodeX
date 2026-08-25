export interface ReleaseAsset {
  key: string
  name: string
  url: string
  size: number
  sha256: string | null
  downloads: number
}

export interface ReleaseData {
  tag: string
  version: string
  name: string
  publishedAt: string
  htmlUrl: string
  prerelease: boolean
  assets: Record<string, ReleaseAsset>
  fetchedAt: string
}

export const REPO = 'Sandeepv68/EncodeX'

const ARTIFACT_PATTERNS: Array<[RegExp, string]> = [
  [/^EncodeX-[\w.+~-]+-x64-setup\.exe$/, 'win-x64'],
  [/^EncodeX-[\w.+~-]+-ia32-setup\.exe$/, 'win-ia32'],
  [/^EncodeX-[\w.+~-]+-arm64-setup\.exe$/, 'win-arm64'],
  [/^EncodeX-[\w.+~-]+-arm64\.dmg$/, 'mac-arm64'],
  [/^EncodeX-[\w.+~-]+-x64\.dmg$/, 'mac-x64'],
  [/^EncodeX-[\w.+~-]+-x86_64\.AppImage$/, 'linux-x86_64'],
  [/^EncodeX-[\w.+~-]+-arm64\.AppImage$/, 'linux-arm64'],
  [/^EncodeX-[\w.+~-]+-armv7l\.AppImage$/, 'linux-armv7l'],
]

interface GitHubAsset {
  name: string
  size: number
  download_count?: number
  digest?: string
  browser_download_url: string
}

interface GitHubRelease {
  tag_name: string
  name: string | null
  published_at: string
  html_url: string
  prerelease?: boolean
  draft?: boolean
  assets: GitHubAsset[]
}

export function normalizeRelease(release: GitHubRelease, fetchedAt: string): ReleaseData {
  const assets: Record<string, ReleaseAsset> = {}
  for (const asset of release.assets) {
    const match = ARTIFACT_PATTERNS.find(([pattern]) => pattern.test(asset.name))
    if (!match) continue
    assets[match[1]] = {
      key: match[1],
      name: asset.name,
      url: asset.browser_download_url,
      size: asset.size,
      sha256: asset.digest?.startsWith('sha256:') ? asset.digest.slice('sha256:'.length) : null,
      downloads: Math.max(0, asset.download_count ?? 0),
    }
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
  }
}

export function totalDownloads(release: ReleaseData): number {
  return Object.values(release.assets).reduce((sum, asset) => sum + asset.downloads, 0)
}

function apiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'encodex-site',
  }
  if (typeof process !== 'undefined' && process.env?.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  return headers
}

export async function fetchLatestRelease(): Promise<ReleaseData> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: apiHeaders(),
  })
  if (!res.ok) {
    throw new Error(`GitHub API responded ${res.status} while fetching latest release`)
  }
  return normalizeRelease((await res.json()) as GitHubRelease, new Date().toISOString())
}

export async function fetchReleases(perPage = 100): Promise<ReleaseData[]> {
  const all: GitHubRelease[] = []
  const maxPages = 10
  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases?per_page=${perPage}&page=${page}`,
      { headers: apiHeaders() },
    )
    if (!res.ok) {
      throw new Error(`GitHub API responded ${res.status} while fetching releases`)
    }
    const list = (await res.json()) as GitHubRelease[]
    all.push(...list)
    if (list.length < perPage) break
  }
  const now = new Date().toISOString()
  return all.filter((rel) => !rel.draft).map((rel) => normalizeRelease(rel, now))
}

// Memoized so every caller shares one set of API requests
let releasesPromise: Promise<ReleaseData[]> | null = null

export function getReleases(): Promise<ReleaseData[]> {
  if (!releasesPromise) {
    releasesPromise = fetchReleases().catch((error) => {
      releasesPromise = null
      throw error
    })
  }
  return releasesPromise
}

// Subscriber pattern — components register to be notified when data refreshes
type ReleaseCallback = (releases: ReleaseData[]) => void
const listeners = new Set<ReleaseCallback>()

export function onReleasesUpdated(cb: ReleaseCallback): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

// Singleton poll — at most one timer across all component instances
const POLL_MS = 60_000
let pollTimer: ReturnType<typeof setInterval> | null = null
let polling = false

export function startReleasePolling() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    if (polling) return
    polling = true
    try {
      releasesPromise = null
      const releases = await getReleases()
      for (const cb of listeners) cb(releases)
    } finally {
      polling = false
    }
  }, POLL_MS)
}

export function stopReleasePolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}
