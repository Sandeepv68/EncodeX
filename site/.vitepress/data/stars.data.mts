import { defineLoader } from 'vitepress'
import { fetchRepoStats, type RepoStats } from './releaseShared'

export declare const data: RepoStats | null

export default defineLoader({
  async load(): Promise<RepoStats | null> {
    try {
      return await fetchRepoStats()
    } catch (error) {
      console.warn(
        '[stars.data] Could not fetch repo stats at build time; the count will stay hidden.',
        error instanceof Error ? error.message : error,
      )
      return null
    }
  },
})