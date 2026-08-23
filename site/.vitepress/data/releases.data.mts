import { defineLoader } from 'vitepress'
import { fetchReleases, type ReleaseData } from './releaseShared'

export type { ReleaseData, ReleaseAsset } from './releaseShared'

export declare const data: ReleaseData[] | null

export default defineLoader({
  async load(): Promise<ReleaseData[] | null> {
    try {
      return await fetchReleases()
    } catch (error) {
      console.warn(
        '[releases.data] Could not fetch releases at build time; previous versions will be resolved on the client.',
        error instanceof Error ? error.message : error,
      )
      return null
    }
  },
})
