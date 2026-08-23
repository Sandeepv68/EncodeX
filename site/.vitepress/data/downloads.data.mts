import { defineLoader } from 'vitepress'
import { fetchReleases, totalDownloads } from './releaseShared'

export declare const data: number | null

export default defineLoader({
  async load(): Promise<number | null> {
    try {
      const releases = await fetchReleases()
      return releases.reduce((sum, release) => sum + totalDownloads(release), 0)
    } catch (error) {
      console.warn(
        '[downloads.data] Could not fetch total downloads at build time; the count will stay hidden.',
        error instanceof Error ? error.message : error,
      )
      return null
    }
  },
})
