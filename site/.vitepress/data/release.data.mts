import { defineLoader } from 'vitepress'
import { fetchLatestRelease, type ReleaseData } from './releaseShared'

export type { ReleaseData, ReleaseAsset } from './releaseShared'

export declare const data: ReleaseData | null

export default defineLoader({
  async load(): Promise<ReleaseData | null> {
    try {
      return await fetchLatestRelease()
    } catch (error) {
      console.warn(
        '[release.data] Could not fetch latest release at build time; download links will be resolved on the client.',
        error instanceof Error ? error.message : error,
      )
      return null
    }
  },
})
