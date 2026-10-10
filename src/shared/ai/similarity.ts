/**
 * @fileoverview Perceptual-hash similarity for media files (roadmap 2.0, F10).
 * Implements average/difference hashes over an 8×8 grayscale frame, Hamming
 * distance, and a deterministic metadata+hash similarity score. Pure math — the
 * frame extraction that feeds {@link averageHash} lives in the MCP server so
 * this module stays Electron- and FFmpeg-free and fully unit-testable.
 */

/**
 * A comparable fingerprint of one media file. Hashes are optional; metadata-only
 * comparison is used when a frame could not be sampled.
 * @interface MediaSignature
 * @property {string} file - The file path.
 * @property {number} [sizeBytes] - File size on disk.
 * @property {number} [durationSeconds] - Media duration.
 * @property {number} [width] - Sampled video width.
 * @property {number} [height] - Sampled video height.
 * @property {string} [hash] - Hex perceptual hash of a sampled frame.
 */
export interface MediaSignature {
  file: string;
  sizeBytes?: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  hash?: string;
}

/**
 * One candidate scored against the subject.
 * @interface SimilarityMatch
 * @property {string} file - The candidate path.
 * @property {number} similarity - Overall score in `[0, 1]`.
 * @property {'duplicate' | 'near-duplicate'} label - Classification at the threshold.
 * @property {number} [hashDistance] - Bit distance when both frames were hashed.
 * @property {number} [durationDeltaSeconds] - Absolute duration difference.
 * @property {boolean} sameResolution - Whether width×height match.
 * @property {string[]} findings - Human-readable observations.
 */
export interface SimilarityMatch {
  file: string;
  similarity: number;
  label: 'duplicate' | 'near-duplicate';
  hashDistance?: number;
  durationDeltaSeconds?: number;
  sameResolution: boolean;
  findings: string[];
}

/**
 * The full similarity report.
 * @interface SimilarityReport
 * @property {string} subject - The reference file.
 * @property {'hash' | 'metadata'} method - Comparison method actually used.
 * @property {number} threshold - Minimum similarity to report.
 * @property {number} compared - Number of candidates compared.
 * @property {SimilarityMatch[]} matches - Ranked candidates above the threshold.
 */
export interface SimilarityReport {
  subject: string;
  method: 'hash' | 'metadata';
  threshold: number;
  compared: number;
  matches: SimilarityMatch[];
}

/**
 * A frame-sampling function: returns a perceptual hash of the frame at
 * `atSeconds` in `file`, or `undefined` when no frame could be sampled (audio
 * only, unsupported container, missing decoder). The MCP server supplies the
 * FFmpeg-backed implementation; tests inject a fake.
 * @typedef {(file: string, atSeconds: number) => Promise<string | undefined>} FrameSampler
 */
export type FrameSampler = (file: string, atSeconds: number) => Promise<string | undefined>;

/**
 * Packs booleans into a hex string, most-significant bit first, padding the tail
 * with zeroes to a nibble boundary.
 * @param {boolean[]} bits - The bit array.
 * @returns {string} The packed hex hash.
 */
function packBits(bits: boolean[]): string {
  const padded = [...bits];
  while (padded.length % 4 !== 0) padded.push(false);
  let hex = '';
  for (let index = 0; index < padded.length; index += 4) {
    let nibble = 0;
    for (let offset = 0; offset < 4; offset += 1) {
      if (padded[index + offset]) nibble |= 1 << (3 - offset);
    }
    hex += nibble.toString(16);
  }
  return hex;
}

/**
 * Population count of a small non-negative integer.
 * @param {number} value - The integer.
 * @returns {number} Number of set bits.
 */
function popcount(value: number): number {
  let count = 0;
  let n = value;
  while (n > 0) {
    count += n & 1;
    n >>= 1;
  }
  return count;
}

/**
 * Total number of bits represented by a hex hash.
 * @param {string} hex - The hex hash.
 * @returns {number} Bit count.
 */
export function hashBitCount(hex: string): number {
  return String(hex ?? '').length * 4;
}

/**
 * Computes an 8×8 average hash (aHash). Each pixel becomes 1 when brighter than
 * the frame mean.
 * @param {ArrayLike<number>} pixels - Grayscale samples, row-major.
 * @param {number} width - Frame width.
 * @param {number} height - Frame height.
 * @returns {string} The hex hash.
 * @throws {RangeError} When the pixel buffer is too small.
 */
export function averageHash(pixels: ArrayLike<number>, width: number, height: number): string {
  const size = width * height;
  if (size <= 0 || pixels.length < size) {
    throw new RangeError(`averageHash requires ${size} pixels, received ${pixels.length}`);
  }
  let total = 0;
  for (let index = 0; index < size; index += 1) total += pixels[index];
  const mean = total / size;
  const bits: boolean[] = [];
  for (let index = 0; index < size; index += 1) bits.push(pixels[index] > mean);
  return packBits(bits);
}

/**
 * Computes a difference hash (dHash): each pixel is compared to its right-hand
 * neighbour, row by row.
 * @param {ArrayLike<number>} pixels - Grayscale samples, row-major.
 * @param {number} width - Frame width (must be >= 2).
 * @param {number} height - Frame height.
 * @returns {string} The hex hash.
 * @throws {RangeError} When width < 2 or the buffer is too small.
 */
export function differenceHash(pixels: ArrayLike<number>, width: number, height: number): string {
  const size = width * height;
  if (width < 2) throw new RangeError('differenceHash requires width >= 2');
  if (pixels.length < size) {
    throw new RangeError(`differenceHash requires ${size} pixels, received ${pixels.length}`);
  }
  const bits: boolean[] = [];
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width - 1; column += 1) {
      bits.push(pixels[row * width + column] > pixels[row * width + column + 1]);
    }
  }
  return packBits(bits);
}

/**
 * Hamming distance between two equal-length hex hashes.
 * @param {string} a - First hash.
 * @param {string} b - Second hash.
 * @returns {number} Number of differing bits.
 */
export function hammingDistance(a: string, b: string): number {
  const left = String(a ?? '');
  const right = String(b ?? '');
  const length = Math.min(left.length, right.length);
  let distance = Math.abs(left.length - right.length) * 4;
  for (let index = 0; index < length; index += 1) {
    const xor = parseInt(left[index], 16) ^ parseInt(right[index], 16);
    distance += popcount(Number.isNaN(xor) ? 0 : xor);
  }
  return distance;
}

/**
 * Converts two hashes into a `[0, 1]` similarity (`1` = identical).
 * @param {string} a - First hash.
 * @param {string} b - Second hash.
 * @returns {number} Similarity score.
 */
export function hashSimilarity(a: string, b: string): number {
  const bits = Math.max(1, hashBitCount(a));
  return Math.max(0, 1 - hammingDistance(a, b) / bits);
}

/**
 * Ratio similarity of two positive numbers (`1` = equal), tolerant of missing
 * values (returns `0.5`, neutral) so an unscored metadata field neither helps nor
 * hurts.
 * @param {number} [a] - First value.
 * @param {number} [b] - Second value.
 * @returns {number} Similarity in `[0, 1]`.
 */
function ratio(a: number | undefined, b: number | undefined): number {
  if (a === undefined || b === undefined) return 0.5;
  const max = Math.max(a, b);
  if (max <= 0) return 1;
  return 1 - Math.abs(a - b) / max;
}

/**
 * Scores one candidate against a subject, producing a {@link SimilarityMatch}
 * regardless of whether it clears a reporting threshold.
 * @param {MediaSignature} subject - The reference signature.
 * @param {MediaSignature} candidate - The candidate signature.
 * @param {number} duplicateThreshold - Score at/above which a match is a duplicate.
 * @returns {SimilarityMatch} The scored match.
 */
function scorePair(subject: MediaSignature, candidate: MediaSignature, duplicateThreshold: number): SimilarityMatch {
  const subjectHash = subject.hash;
  const candidateHash = candidate.hash;
  const useHash = Boolean(subjectHash && candidateHash);
  const durationDeltaSeconds =
    subject.durationSeconds !== undefined && candidate.durationSeconds !== undefined
      ? Math.abs(subject.durationSeconds - candidate.durationSeconds)
      : undefined;
  const sameResolution =
    subject.width !== undefined && subject.height !== undefined && subject.width === candidate.width && subject.height === candidate.height;
  const similarity = useHash
    ? 0.6 * hashSimilarity(subjectHash as string, candidateHash as string) +
      0.2 * ratio(subject.durationSeconds, candidate.durationSeconds) +
      0.1 * (sameResolution ? 1 : 0.5) +
      0.1 * ratio(subject.sizeBytes, candidate.sizeBytes)
    : 0.5 * ratio(subject.durationSeconds, candidate.durationSeconds) +
      0.3 * (sameResolution ? 1 : 0.5) +
      0.2 * ratio(subject.sizeBytes, candidate.sizeBytes);
  const findings: string[] = [];
  let hashDistance: number | undefined;
  if (useHash) {
    hashDistance = hammingDistance(subjectHash as string, candidateHash as string);
    if (hashDistance === 0) findings.push('sampled frames are identical');
    else if (hashDistance <= Math.ceil(hashBitCount(subjectHash as string) * 0.1)) {
      findings.push('sampled frames are visually near-identical');
    }
  }
  if (durationDeltaSeconds !== undefined && durationDeltaSeconds <= 1) findings.push('same duration');
  if (durationDeltaSeconds !== undefined && durationDeltaSeconds > 1) {
    findings.push(`duration differs by ${durationDeltaSeconds.toFixed(1)}s`);
  }
  if (sameResolution) findings.push('same resolution');
  const sameContent =
    (hashDistance !== undefined && hashDistance <= Math.ceil(hashBitCount(subjectHash as string) * 0.1)) ||
    (durationDeltaSeconds !== undefined && durationDeltaSeconds <= 1 && sameResolution);
  if (
    sameContent &&
    subject.sizeBytes !== undefined &&
    candidate.sizeBytes !== undefined &&
    Math.abs(subject.sizeBytes - candidate.sizeBytes) > Math.max(1024, subject.sizeBytes * 0.02)
  ) {
    findings.push('same content, different file size (likely a re-encode)');
  }
  const label = similarity >= duplicateThreshold ? 'duplicate' : 'near-duplicate';
  const match: SimilarityMatch = {
    file: candidate.file,
    similarity: Number(similarity.toFixed(4)),
    label,
    sameResolution,
    findings,
  };
  if (hashDistance !== undefined) match.hashDistance = hashDistance;
  if (durationDeltaSeconds !== undefined) match.durationDeltaSeconds = Number(durationDeltaSeconds.toFixed(3));
  return match;
}

/**
 * Compares a subject signature to candidates and returns the ranked report.
 * @param {MediaSignature} subject - The reference signature.
 * @param {MediaSignature[]} candidates - Signatures to compare against.
 * @param {object} [options] - Comparison options.
 * @param {number} [options.threshold] - Minimum similarity to report (default 0.75).
 * @param {number} [options.duplicateThreshold] - Score at/above which a match is a duplicate (default 0.92).
 * @returns {SimilarityReport} The report.
 */
export function compareSignatures(
  subject: MediaSignature,
  candidates: MediaSignature[],
  options: { threshold?: number; duplicateThreshold?: number } = {},
): SimilarityReport {
  const threshold = options.threshold ?? 0.75;
  const duplicateThreshold = options.duplicateThreshold ?? 0.92;
  let hashUsable = Boolean(subject.hash);
  const matches: SimilarityMatch[] = [];
  for (const candidate of candidates) {
    if (candidate.file === subject.file) continue;
    if (subject.hash && candidate.hash) hashUsable = true;
    const match = scorePair(subject, candidate, duplicateThreshold);
    if (match.similarity < threshold) continue;
    matches.push(match);
  }
  matches.sort((a, b) => b.similarity - a.similarity || a.file.localeCompare(b.file));
  return {
    subject: subject.file,
    method: hashUsable ? 'hash' : 'metadata',
    threshold,
    compared: candidates.filter((candidate) => candidate.file !== subject.file).length,
    matches,
  };
}

/**
 * A group of files that are all mutually similar (a dedupe cluster).
 * @interface SimilarityCluster
 * @property {string[]} files - The clustered file paths (sorted).
 * @property {number} similarity - Highest pairwise score in the cluster.
 * @property {'duplicate' | 'near-duplicate'} label - Cluster classification.
 */
export interface SimilarityCluster {
  files: string[];
  similarity: number;
  label: 'duplicate' | 'near-duplicate';
}

/**
 * The result of clustering a set of signatures.
 * @interface ClusterReport
 * @property {'hash' | 'metadata'} method - Comparison method used.
 * @property {number} threshold - Minimum similarity to cluster.
 * @property {number} compared - Number of signatures considered.
 * @property {SimilarityCluster[]} clusters - Clusters of two or more files.
 * @property {SimilarityMatch[]} pairs - All above-threshold pairs, ranked.
 */
export interface ClusterReport {
  method: 'hash' | 'metadata';
  threshold: number;
  compared: number;
  clusters: SimilarityCluster[];
  pairs: SimilarityMatch[];
}

/**
 * Groups mutually-similar signatures into clusters (dedupe). Uses a transitive
 * union-find over all pairs at or above `threshold`, so A~B and B~C put A, B and
 * C in one cluster. Deterministic for a given input.
 * @param {MediaSignature[]} signatures - The signatures to cluster.
 * @param {object} [options] - Clustering options.
 * @param {number} [options.threshold] - Minimum similarity to link (default 0.75).
 * @param {number} [options.duplicateThreshold] - Score at/above which a pair is a duplicate (default 0.92).
 * @returns {ClusterReport} The clusters and ranked pairs.
 */
export function clusterSignatures(
  signatures: MediaSignature[],
  options: { threshold?: number; duplicateThreshold?: number } = {},
): ClusterReport {
  const threshold = options.threshold ?? 0.75;
  const duplicateThreshold = options.duplicateThreshold ?? 0.92;
  const parent = signatures.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    let current = index;
    while (parent[current] !== current) {
      const next = parent[current];
      parent[current] = root;
      current = next;
    }
    return root;
  };
  const union = (a: number, b: number): void => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };
  const pairs: SimilarityMatch[] = [];
  let hashUsable = signatures.some((signature) => Boolean(signature.hash));
  for (let i = 0; i < signatures.length; i += 1) {
    for (let j = i + 1; j < signatures.length; j += 1) {
      const match = scorePair(signatures[i], signatures[j], duplicateThreshold);
      if (signatures[i].hash && signatures[j].hash) hashUsable = true;
      if (match.similarity < threshold) continue;
      pairs.push(match);
      union(i, j);
    }
  }
  const groups = new Map<number, number[]>();
  signatures.forEach((_, index) => {
    const root = find(index);
    const bucket = groups.get(root);
    if (bucket) bucket.push(index);
    else groups.set(root, [index]);
  });
  const pairsByFile = new Map<string, number>();
  for (const match of pairs) {
    pairsByFile.set(match.file, Math.max(pairsByFile.get(match.file) ?? 0, match.similarity));
  }
  const clusters: SimilarityCluster[] = [];
  for (const indices of groups.values()) {
    if (indices.length < 2) continue;
    const files = indices.map((index) => signatures[index].file).sort();
    let top = 0;
    for (const file of files) top = Math.max(top, pairsByFile.get(file) ?? 0);
    clusters.push({
      files,
      similarity: Number(top.toFixed(4)),
      label: top >= duplicateThreshold ? 'duplicate' : 'near-duplicate',
    });
  }
  clusters.sort((a, b) => b.similarity - a.similarity || b.files.length - a.files.length || a.files[0].localeCompare(b.files[0]));
  pairs.sort((a, b) => b.similarity - a.similarity || a.file.localeCompare(b.file));
  return {
    method: hashUsable ? 'hash' : 'metadata',
    threshold,
    compared: signatures.length,
    clusters,
    pairs,
  };
}
