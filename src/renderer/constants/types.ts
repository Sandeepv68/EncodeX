/**
 * @fileoverview Type definitions for the renderer constants.
 * Declares the shapes of the central keyboard shortcut registry: the help
 * dialog sections, a single registered shortcut, and a parsed key chord.
 */

/**
 * Sections used to group shortcuts in the help dialog. The order of
 * `SHORTCUT_SECTIONS` determines the display order.
 * @typedef {string} ShortcutSection
 */
export type ShortcutSection =
  | 'global'
  | 'convert'
  | 'mediaInfo'
  | 'imageCompress'
  | 'audioExtract'
  | 'videoCut'
  | 'remux'
  | 'demux'
  | 'batchQueue'
  | 'logs'
  | 'dashboard';

/**
 * One registered shortcut.
 * @interface HotkeySpec
 * @property {string} id - Unique identifier, used by `useHotkeys` bindings and
 *   tests (convention: `<section>.<name>`).
 * @property {string} keys - Canonical chord, e.g. 'Ctrl+Shift+S' or 'Space'.
 * @property {string} labelKey - i18n key for the action label, rendered in the
 *   help dialog and tooltip hints.
 * @property {ShortcutSection} section - Help-dialog section the shortcut is
 *   listed under.
 * @property {string} [to] - Target route path for navigation shortcuts (global
 *   Alt+1..9 and dashboard number keys).
 */
export interface HotkeySpec {
  id: string;
  keys: string;
  labelKey: string;
  section: ShortcutSection;
  to?: string;
}

/**
 * A key chord parsed into a matchable predicate.
 * @interface ParsedShortcut
 * @property {boolean} primary - True when the platform primary modifier
 *   (Ctrl/Cmd) must be down.
 * @property {boolean} alt - True when Alt must be down.
 * @property {boolean} shift - True when Shift must be down.
 * @property {string} code - The `event.code` value that must match.
 */
export interface ParsedShortcut {
  primary: boolean;
  alt: boolean;
  shift: boolean;
  code: string;
}
