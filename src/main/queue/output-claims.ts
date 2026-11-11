/**
 * @fileoverview Output-path claims shared by the batch queue and the mux queue.
 *
 * Two independent queues writing to the same file is the failure this module
 * prevents: the second run silently overwrites the first one's output, and the
 * user is left with whichever file happened to be written last.
 *
 * Each queue registers the output paths it claims. A queue checks the *other*
 * queue's claims before accepting a job, so neither side can claim a path the
 * other already owns. Claims are reference-counted by job id, so removing one
 * of two jobs that share a path keeps the path claimed.
 */

/**
 * Normalizes a file path for comparison: lowercases and unifies Windows
 * backslashes with POSIX forward slashes.
 *
 * A non-string input (a hostile renderer can send anything) normalizes to the
 * empty string, which is never a claimed path - so a malformed argument is
 * reported as "not claimed" instead of throwing inside the check.
 * @param {unknown} value - The path to normalize.
 * @returns {string} The normalized path, or '' for a non-string input.
 */
export function normalizeClaimPath(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\\/g, '/').toLowerCase();
}

/**
 * A registry of output paths claimed by the jobs of one queue.
 * @class OutputClaimRegistry
 */
export class OutputClaimRegistry {
  /** Claimed paths mapped to the ids of the jobs that claim them. */
  private readonly claims = new Map<string, Set<string>>();

  /**
   * Records that a job claims an output path.
   * @param {string} output - The output path.
   * @param {string} ownerId - The id of the claiming job.
   * @returns {void}
   */
  claim(output: string, ownerId: string): void {
    const key = normalizeClaimPath(output);
    if (!key) return;
    const owners = this.claims.get(key);
    if (owners) {
      owners.add(ownerId);
      return;
    }
    this.claims.set(key, new Set([ownerId]));
  }

  /**
   * Releases a job's claim on an output path. The path stays claimed while
   * another job still claims it.
   * @param {string} output - The output path.
   * @param {string} ownerId - The id of the job releasing the claim.
   * @returns {void}
   */
  release(output: string, ownerId: string): void {
    const key = normalizeClaimPath(output);
    if (!key) return;
    const owners = this.claims.get(key);
    if (!owners) return;
    owners.delete(ownerId);
    if (owners.size === 0) this.claims.delete(key);
  }

  /**
   * Releases every claim held by a job.
   * @param {string} ownerId - The id of the job releasing its claims.
   * @returns {void}
   */
  releaseAll(ownerId: string): void {
    for (const [key, owners] of [...this.claims.entries()]) {
      owners.delete(ownerId);
      if (owners.size === 0) this.claims.delete(key);
    }
  }

  /**
   * Reports which of the given paths are already claimed.
   * @param {string[]} outputs - The output paths to test.
   * @returns {string[]} The claimed paths, in the order they were given.
   */
  findConflicts(outputs: string[]): string[] {
    if (!Array.isArray(outputs)) return [];
    return outputs.filter((output) => this.isClaimed(output));
  }

  /**
   * True when the given path is claimed by any job.
   * @param {unknown} output - The output path to test.
   * @returns {boolean} True when the path is claimed.
   */
  isClaimed(output: unknown): boolean {
    const key = normalizeClaimPath(output);
    if (!key) return false;
    return this.claims.has(key);
  }
}

/** The output paths claimed by the batch conversion queue. */
export const batchOutputClaims = new OutputClaimRegistry();

/** The output paths claimed by the remux/demux mux queue. */
export const muxOutputClaims = new OutputClaimRegistry();
