/**
 * @fileoverview Folder-name helpers shared by the demux page and the
 * extraction planners.
 *
 * The demux page can collect the extracted streams of one source file into a
 * dedicated folder. That folder lives inside the chosen output directory and
 * is labeled after the source file, so it has to obey the naming rules of the
 * file system: no path separators, no characters that Windows rejects, no
 * trailing dot or space, and no reserved device name.
 *
 * `sanitizeFolderName` applies those rules to an arbitrary label;
 * `defaultFolderNameForFile` derives the label from a media file name.
 */

/**
 * Characters that are not allowed in a folder name on Windows (and are
 * undesirable everywhere): path separators, the Windows-reserved punctuation
 * and every control character.
 * @const {RegExp} INVALID_FOLDER_CHARS
 */
const INVALID_FOLDER_CHARS = /[\u0000-\u001f<>:\/\\|?*"]/g;

/**
 * Folder names reserved by Windows for legacy devices (CON, PRN, AUX, NUL and
 * the COM/LPT series). A folder with such a name cannot be created.
 * @const {RegExp} RESERVED_FOLDER_NAMES
 */
const RESERVED_FOLDER_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Maximum length of a generated folder name. Long enough for any realistic
 * media title, short enough to stay below the Windows path limit once the
 * output directory is prepended.
 * @const {number} MAX_FOLDER_NAME_LENGTH
 */
const MAX_FOLDER_NAME_LENGTH = 120;

/**
 * Fallback folder name used when a label contains nothing usable.
 * @const {string} FALLBACK_FOLDER_NAME
 */
const FALLBACK_FOLDER_NAME = 'extracted';

/**
 * Sanitizes an arbitrary label into a valid folder name.
 *
 * Illegal characters are replaced with a dash, runs of dashes are collapsed,
 * whitespace runs are collapsed into a single space, and leading/trailing dots,
 * spaces and dashes are removed (Windows silently drops trailing dots and
 * spaces). Reserved device names get an underscore appended. An empty result
 * means the label carried no usable characters and the caller should fall
 * back to a default.
 * @param {string} name - The raw label.
 * @returns {string} A valid folder name, or '' when nothing usable remains.
 */
export function sanitizeFolderName(name: string): string {
  if (!name) return '';
  const replaced = name
    .replace(INVALID_FOLDER_CHARS, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const trimmed = replaced
    .slice(0, MAX_FOLDER_NAME_LENGTH)
    .replace(/^[-. ]+/, '')
    .replace(/[-. ]+$/g, '');
  if (!trimmed) return '';
  const base = trimmed.split('.')[0] ?? trimmed;
  return RESERVED_FOLDER_NAMES.test(base) ? `${trimmed}_` : trimmed;
}

/**
 * Derives the default folder label for a media file: the file name without
 * its extension, sanitized into a valid folder name.
 * @param {string} file - Path of the source media file.
 * @returns {string} The default folder name (never empty).
 */
export function defaultFolderNameForFile(file: string): string {
  if (!file) return FALLBACK_FOLDER_NAME;
  const parts = file.split(/[\\/]/);
  const base = parts[parts.length - 1] ?? file;
  const dotIdx = base.lastIndexOf('.');
  const stem = dotIdx > 0 ? base.slice(0, dotIdx) : base;
  return sanitizeFolderName(stem) || FALLBACK_FOLDER_NAME;
}
