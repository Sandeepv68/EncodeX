/**
 * @fileoverview Media file discovery helpers for batch import.
 * Collects supported media files from a folder tree (recursively for whole
 * folder imports) and expands a mixed list of file/directory paths into the
 * media files they contain. The recursive directory walk intentionally skips
 * symlinked directories and unreadable entries so a single inaccessible folder
 * never aborts an import. Results are normalized, deduplicated, and sorted for
 * deterministic ordering.
 */

import * as fs from 'fs';
import * as path from 'path';
import { FILE_EXTENSIONS } from '../shared/file-extensions';

/**
 * Set of supported media input extensions (lower-cased, without dot).
 * @const {Set<string>} MEDIA_INPUT_EXTENSIONS
 */
const MEDIA_INPUT_EXTENSIONS: Set<string> = new Set(FILE_EXTENSIONS.MEDIA_INPUT);

/**
 * Returns whether the given path names a supported media input file.
 * A path without a known media extension returns false.
 * @param {string} filePath - The file path to test.
 * @returns {boolean} True when the file's lower-cased extension is a supported
 *   media input extension.
 */
function isMediaFile(filePath: string): boolean {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return MEDIA_INPUT_EXTENSIONS.has(ext);
}

/**
 * Collects the supported media files found in a directory tree.
 *
 * The walk is depth-first and non-recursive-safe-by-construction: each directory
 * is read with `withFileTypes`, so directories are detected without extra stats
 * and symbolic links are never followed (preventing cycles). Files that cannot
 * be read are skipped rather than thrown.
 *
 * @param {string} root - Absolute path of the directory to scan.
 * @returns {string[]} Sorted, unique, absolute paths of every supported media
 *   file in the tree (an empty array when the root is missing/unreadable).
 */
export function collectMediaFiles(root: string): string[] {
  const found = new Map<string, string>();

  const visitDir = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visitDir(full);
      } else if (entry.isSymbolicLink()) {
        let stat: fs.Stats;
        try {
          stat = fs.statSync(full);
        } catch {
          continue;
        }
        if (stat.isFile() && isMediaFile(full)) found.set(path.normalize(full), full);
      } else if (entry.isFile() && isMediaFile(full)) {
        found.set(path.normalize(full), full);
      }
    }
  };

  visitDir(root);
  return [...found.values()].sort();
}

/**
 * Expands an arbitrary list of existing paths into the media files they
 * contain: directories are walked recursively (via {@link collectMediaFiles})
 * and plain media files pass through unchanged. A path that is neither a media
 * file nor a directory (or does not exist) is ignored.
 * @param {string[]} paths - Mixed file/directory paths to expand.
 * @returns {string[]} Sorted, unique media file paths.
 */
export function expandMediaPaths(paths: string[]): string[] {
  const result = new Map<string, string>();

  for (const raw of paths) {
    const abs = path.resolve(raw);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(abs);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      for (const file of collectMediaFiles(abs)) result.set(path.normalize(file), file);
    } else if (stat.isFile() && isMediaFile(abs)) {
      result.set(path.normalize(abs), abs);
    }
  }

  return [...result.values()].sort();
}

/**
 * Resolves whether a path refers to an existing directory (union of
 * `/` and `\` separators handled by path.resolve). Exported for the dialog
 * layer to branch on before walking a chosen folder.
 * @param {string} candidate - The path to check.
 * @returns {boolean} True when the path exists and is a directory.
 */
export function isDirectory(candidate: string): boolean {
  try {
    return fs.statSync(path.resolve(candidate)).isDirectory();
  } catch {
    return false;
  }
}
