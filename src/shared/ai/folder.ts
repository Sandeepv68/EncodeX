/**
 * @fileoverview Deterministic media-library savings summary (roadmap F9).
 *
 * Aggregates per-file projections into the folder-level numbers the "Media
 * Librarian" report shows: how much space a batch re-encode would reclaim. All
 * arithmetic lives here (roadmap §7.3) and is unit-tested; the per-file
 * projections are computed by the caller from the shared estimator. The summary
 * is always `isEstimated: true` (D4) — nothing has been encoded yet.
 */

import type { LibraryRow, LibrarySummary } from './types';

export type { LibraryRow, LibrarySummary };

/**
 * Builds a per-file row from a source and a projected size, deriving the
 * savings fields consistently.
 * @param {string} input - Absolute path of the source file.
 * @param {number} sourceBytes - Current size in bytes.
 * @param {number} estimatedBytes - Projected size in bytes.
 * @param {{ targetBytes?: number; profileId?: string }} [extra] - Optional labels.
 * @returns {LibraryRow} The derived row.
 */
export function libraryRow(
  input: string,
  sourceBytes: number,
  estimatedBytes: number,
  extra: { targetBytes?: number; profileId?: string } = {},
): LibraryRow {
  const source = Number(sourceBytes) || 0;
  const estimated = Number(estimatedBytes) || 0;
  const savingsBytes = source - estimated;
  return {
    input,
    sourceBytes: source,
    estimatedBytes: estimated,
    savingsBytes,
    savingsPercent: source > 0 ? Math.round((savingsBytes / source) * 100) : 0,
    ...extra,
  };
}

/**
 * Aggregates per-file projections into a folder-level savings summary.
 *
 * Only rows without an `error` contribute to the totals; the rest are counted
 * separately so the report can surface failures without skewing the numbers.
 * Ties in the "largest savings" list fall back to input path for determinism.
 * @param {LibraryRow[]} rows - Per-file projections.
 * @returns {LibrarySummary} The roll-up.
 */
export function summarizeLibrary(rows: LibraryRow[]): LibrarySummary {
  const usable = rows.filter((row) => !row.error);
  const errors = rows.length - usable.length;
  let totalSourceBytes = 0;
  let totalEstimatedBytes = 0;
  for (const row of usable) {
    totalSourceBytes += row.sourceBytes;
    totalEstimatedBytes += row.estimatedBytes;
  }
  const totalSavingsBytes = totalSourceBytes - totalEstimatedBytes;
  const notes: string[] = [];
  if (errors > 0) notes.push(`${errors} file${errors === 1 ? '' : 's'} could not be projected and were excluded from the totals.`);
  if (usable.length === 0) notes.push('No files could be projected; there is nothing to save.');
  else if (totalSavingsBytes <= 0) notes.push('The recommended settings are not projected to reduce the total size.');
  notes.push('Projections use bitrate arithmetic over the probed durations; encode and re-probe to confirm.');

  const largest = [...usable].sort((a, b) => b.savingsBytes - a.savingsBytes || a.input.localeCompare(b.input)).slice(0, 5);

  return {
    isEstimated: true,
    fileCount: rows.length,
    analyzedCount: usable.length,
    errorCount: errors,
    totalSourceBytes,
    totalEstimatedBytes,
    totalSavingsBytes,
    savingsPercent: totalSourceBytes > 0 ? Math.round((totalSavingsBytes / totalSourceBytes) * 100) : 0,
    largest,
    notes,
  };
}
