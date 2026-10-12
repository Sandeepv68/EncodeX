/**
 * @fileoverview Deterministic media-library savings summary (roadmap F9).
 *
 * Aggregates per-file projections into the folder-level numbers the "Media
 * Librarian" report shows: how much space a batch re-encode would reclaim. All
 * arithmetic lives here (roadmap §7.3) and is unit-tested; the per-file
 * projections are computed by the caller from the shared estimator. The summary
 * is always `isEstimated: true` (D4) — nothing has been encoded yet.
 */

/**
 * One projected file in a library report.
 * @interface LibraryRow
 * @property {string} input - Absolute path of the source file.
 * @property {number} sourceBytes - Current file size in bytes.
 * @property {number} estimatedBytes - Projected size after the recommended encode.
 * @property {number} savingsBytes - `sourceBytes - estimatedBytes` (may be negative).
 * @property {number} savingsPercent - Signed savings as a whole-number percentage.
 * @property {number} [targetBytes] - The per-file ceiling the projection aimed at.
 * @property {string} [profileId] - Built-in profile used, when applicable.
 * @property {string} [error] - Why the file could not be projected.
 */
export interface LibraryRow {
  input: string;
  sourceBytes: number;
  estimatedBytes: number;
  savingsBytes: number;
  savingsPercent: number;
  targetBytes?: number;
  profileId?: string;
  error?: string;
}

/**
 * The folder-level savings roll-up.
 * @interface LibrarySummary
 * @property {true} isEstimated - Always true: projections, not measurements.
 * @property {number} fileCount - Number of rows considered.
 * @property {number} analyzedCount - Rows with a usable projection.
 * @property {number} errorCount - Rows that could not be projected.
 * @property {number} totalSourceBytes - Sum of analyzable source sizes.
 * @property {number} totalEstimatedBytes - Sum of projected sizes.
 * @property {number} totalSavingsBytes - `totalSourceBytes - totalEstimatedBytes`.
 * @property {number} savingsPercent - Signed savings as a whole-number percentage.
 * @property {LibraryRow[]} largest - Up to five rows with the biggest byte savings.
 * @property {string[]} notes - Assumptions and caveats.
 */
export interface LibrarySummary {
  isEstimated: true;
  fileCount: number;
  analyzedCount: number;
  errorCount: number;
  totalSourceBytes: number;
  totalEstimatedBytes: number;
  totalSavingsBytes: number;
  savingsPercent: number;
  largest: LibraryRow[];
  notes: string[];
}

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
