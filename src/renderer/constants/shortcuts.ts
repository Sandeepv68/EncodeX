/**
 * @fileoverview Central keyboard shortcut registry.
 *
 * Single source of truth for every keyboard shortcut in the app. Each entry
 * (`HotkeySpec`) carries a canonical key chord (e.g. 'Ctrl+O', 'Alt+3',
 * 'Space'), the i18n key for its action label, the help-dialog section it
 * belongs to, and (for navigation shortcuts) the target route.
 *
 * The registry drives every shortcut consumer so they can never drift apart:
 *  - the `useHotkeys` hook matches key chords against the registry,
 *  - the `ShortcutsHelpDialog` renders the same entries,
 *  - tooltips derive their hint text from the same label/keys pairs.
 *
 * Chord syntax:
 *  - 'Ctrl' is the platform primary modifier (Ctrl on Windows/Linux, Cmd on
 *    macOS). 'Alt' and 'Shift' are literal.
 *  - Key tokens are matched by `event.code` (KeyO, Digit3, Space, ArrowLeft…)
 *    so they work independently of keyboard layout.
 *
 * Also exports the pure parsing/matching helpers (`parseShortcut`,
 * `shortcutMatches`, `formatShortcut`) used by both the hook and the help
 * dialog; these are unit-tested in `__tests__/shortcuts.test.ts`.
 */

/**
 * Sections used to group shortcuts in the help dialog. The order of
 * `SHORTCUT_SECTIONS` determines the display order.
 * @typedef {string} ShortcutSection
 */
export type ShortcutSection =
  'global' | 'convert' | 'mediaInfo' | 'imageCompress' | 'audioExtract' | 'videoCut' | 'batchQueue' | 'logs' | 'dashboard';

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
 * Ordered list of help-dialog sections and their i18n labels.
 * @const {readonly {id: ShortcutSection; labelKey: string}[]} SHORTCUT_SECTIONS
 */
export const SHORTCUT_SECTIONS: readonly { id: ShortcutSection; labelKey: string }[] = [
  { id: 'global', labelKey: 'shortcuts.sections.global' },
  { id: 'convert', labelKey: 'shortcuts.sections.convert' },
  { id: 'mediaInfo', labelKey: 'shortcuts.sections.mediaInfo' },
  { id: 'imageCompress', labelKey: 'shortcuts.sections.imageCompress' },
  { id: 'audioExtract', labelKey: 'shortcuts.sections.audioExtract' },
  { id: 'videoCut', labelKey: 'shortcuts.sections.videoCut' },
  { id: 'batchQueue', labelKey: 'shortcuts.sections.batchQueue' },
  { id: 'logs', labelKey: 'shortcuts.sections.logs' },
  { id: 'dashboard', labelKey: 'shortcuts.sections.dashboard' },
];

/**
 * All registered shortcuts, ordered for the help dialog.
 * @const {readonly HotkeySpec[]} SHORTCUTS
 */
export const SHORTCUTS: readonly HotkeySpec[] = [
  { id: 'global.help', keys: 'Ctrl+/', labelKey: 'shortcuts.global.help', section: 'global' },
  { id: 'global.navDashboard', keys: 'Alt+1', labelKey: 'shortcuts.global.navDashboard', section: 'global', to: '/' },
  { id: 'global.navConvert', keys: 'Alt+2', labelKey: 'shortcuts.global.navConvert', section: 'global', to: '/convert' },
  { id: 'global.navMediaInfo', keys: 'Alt+3', labelKey: 'shortcuts.global.navMediaInfo', section: 'global', to: '/media-info' },
  { id: 'global.navImage', keys: 'Alt+4', labelKey: 'shortcuts.global.navImage', section: 'global', to: '/image-compress' },
  { id: 'global.navAudio', keys: 'Alt+5', labelKey: 'shortcuts.global.navAudio', section: 'global', to: '/audio-extract' },
  { id: 'global.navCut', keys: 'Alt+6', labelKey: 'shortcuts.global.navCut', section: 'global', to: '/video-cut' },
  { id: 'global.navBatchQueue', keys: 'Alt+7', labelKey: 'shortcuts.global.navBatchQueue', section: 'global', to: '/batch' },
  { id: 'global.navLogs', keys: 'Alt+8', labelKey: 'shortcuts.global.navLogs', section: 'global', to: '/logs' },
  { id: 'global.navSettings', keys: 'Alt+9', labelKey: 'shortcuts.global.navSettings', section: 'global', to: '/settings' },
  { id: 'global.themeToggle', keys: 'Ctrl+Alt+T', labelKey: 'shortcuts.global.themeToggle', section: 'global' },
  { id: 'convert.input', keys: 'Ctrl+O', labelKey: 'shortcuts.convert.input', section: 'convert' },
  { id: 'convert.output', keys: 'Ctrl+Shift+S', labelKey: 'shortcuts.convert.output', section: 'convert' },
  { id: 'convert.start', keys: 'Ctrl+Enter', labelKey: 'shortcuts.convert.start', section: 'convert' },
  { id: 'convert.pause', keys: 'Ctrl+Shift+P', labelKey: 'shortcuts.convert.pause', section: 'convert' },
  { id: 'convert.cancel', keys: 'Ctrl+Shift+C', labelKey: 'shortcuts.convert.cancel', section: 'convert' },
  { id: 'convert.clear', keys: 'Ctrl+Shift+X', labelKey: 'shortcuts.convert.clear', section: 'convert' },
  { id: 'convert.lossless', keys: 'L', labelKey: 'shortcuts.convert.lossless', section: 'convert' },
  { id: 'convert.preview', keys: 'P', labelKey: 'shortcuts.convert.preview', section: 'convert' },
  { id: 'mediaInfo.open', keys: 'Ctrl+O', labelKey: 'shortcuts.mediaInfo.open', section: 'mediaInfo' },
  { id: 'imageCompress.input', keys: 'Ctrl+O', labelKey: 'shortcuts.imageCompress.input', section: 'imageCompress' },
  { id: 'imageCompress.output', keys: 'Ctrl+Shift+S', labelKey: 'shortcuts.imageCompress.output', section: 'imageCompress' },
  { id: 'imageCompress.compress', keys: 'Ctrl+Enter', labelKey: 'shortcuts.imageCompress.compress', section: 'imageCompress' },
  { id: 'imageCompress.aspect', keys: 'K', labelKey: 'shortcuts.imageCompress.aspect', section: 'imageCompress' },
  { id: 'audioExtract.input', keys: 'Ctrl+O', labelKey: 'shortcuts.audioExtract.input', section: 'audioExtract' },
  { id: 'audioExtract.output', keys: 'Ctrl+Shift+S', labelKey: 'shortcuts.audioExtract.output', section: 'audioExtract' },
  { id: 'audioExtract.extract', keys: 'Ctrl+Enter', labelKey: 'shortcuts.audioExtract.extract', section: 'audioExtract' },
  { id: 'audioExtract.pause', keys: 'Ctrl+Shift+P', labelKey: 'shortcuts.audioExtract.pause', section: 'audioExtract' },
  { id: 'audioExtract.cancel', keys: 'Ctrl+Shift+C', labelKey: 'shortcuts.audioExtract.cancel', section: 'audioExtract' },
  { id: 'videoCut.open', keys: 'Ctrl+O', labelKey: 'shortcuts.videoCut.open', section: 'videoCut' },
  { id: 'videoCut.output', keys: 'Ctrl+Shift+S', labelKey: 'shortcuts.videoCut.output', section: 'videoCut' },
  { id: 'videoCut.cut', keys: 'Ctrl+Enter', labelKey: 'shortcuts.videoCut.cut', section: 'videoCut' },
  { id: 'videoCut.pause', keys: 'Ctrl+Shift+P', labelKey: 'shortcuts.videoCut.pause', section: 'videoCut' },
  { id: 'videoCut.cancel', keys: 'Ctrl+Shift+C', labelKey: 'shortcuts.videoCut.cancel', section: 'videoCut' },
  { id: 'videoCut.clear', keys: 'Ctrl+Shift+X', labelKey: 'shortcuts.videoCut.clear', section: 'videoCut' },
  { id: 'videoCut.useDuration', keys: 'U', labelKey: 'shortcuts.videoCut.useDuration', section: 'videoCut' },
  { id: 'videoCut.includeAudio', keys: 'A', labelKey: 'shortcuts.videoCut.includeAudio', section: 'videoCut' },
  { id: 'videoCut.playPause', keys: 'Space', labelKey: 'shortcuts.videoCut.playPause', section: 'videoCut' },
  { id: 'videoCut.mute', keys: 'M', labelKey: 'shortcuts.videoCut.mute', section: 'videoCut' },
  { id: 'videoCut.seekBack', keys: 'ArrowLeft', labelKey: 'shortcuts.videoCut.seekBack', section: 'videoCut' },
  { id: 'videoCut.seekForward', keys: 'ArrowRight', labelKey: 'shortcuts.videoCut.seekForward', section: 'videoCut' },
  { id: 'batchQueue.add', keys: 'Ctrl+O', labelKey: 'shortcuts.batchQueue.add', section: 'batchQueue' },
  { id: 'batchQueue.start', keys: 'Ctrl+Enter', labelKey: 'shortcuts.batchQueue.start', section: 'batchQueue' },
  { id: 'batchQueue.pause', keys: 'Ctrl+Shift+P', labelKey: 'shortcuts.batchQueue.pause', section: 'batchQueue' },
  { id: 'batchQueue.cancelAll', keys: 'Ctrl+Shift+C', labelKey: 'shortcuts.batchQueue.cancelAll', section: 'batchQueue' },
  { id: 'batchQueue.clearCompleted', keys: 'Ctrl+Shift+X', labelKey: 'shortcuts.batchQueue.clearCompleted', section: 'batchQueue' },
  { id: 'batchQueue.export', keys: 'Ctrl+E', labelKey: 'shortcuts.batchQueue.export', section: 'batchQueue' },
  { id: 'batchQueue.import', keys: 'Ctrl+I', labelKey: 'shortcuts.batchQueue.import', section: 'batchQueue' },
  { id: 'batchQueue.condense', keys: 'C', labelKey: 'shortcuts.batchQueue.condense', section: 'batchQueue' },
  { id: 'batchQueue.focusSearch', keys: 'F', labelKey: 'shortcuts.batchQueue.focusSearch', section: 'batchQueue' },
  { id: 'batchQueue.filterAll', keys: '1', labelKey: 'shortcuts.batchQueue.filterAll', section: 'batchQueue' },
  { id: 'batchQueue.filterQueued', keys: '2', labelKey: 'shortcuts.batchQueue.filterQueued', section: 'batchQueue' },
  { id: 'batchQueue.filterRunning', keys: '3', labelKey: 'shortcuts.batchQueue.filterRunning', section: 'batchQueue' },
  { id: 'batchQueue.filterDone', keys: '4', labelKey: 'shortcuts.batchQueue.filterDone', section: 'batchQueue' },
  { id: 'batchQueue.filterFailed', keys: '5', labelKey: 'shortcuts.batchQueue.filterFailed', section: 'batchQueue' },
  { id: 'logs.clear', keys: 'Ctrl+L', labelKey: 'shortcuts.logs.clear', section: 'logs' },
  { id: 'logs.download', keys: 'Ctrl+Shift+D', labelKey: 'shortcuts.logs.download', section: 'logs' },
  { id: 'dashboard.convert', keys: '1', labelKey: 'shortcuts.dashboard.convert', section: 'dashboard', to: '/convert' },
  { id: 'dashboard.mediaInfo', keys: '2', labelKey: 'shortcuts.dashboard.mediaInfo', section: 'dashboard', to: '/media-info' },
  { id: 'dashboard.image', keys: '3', labelKey: 'shortcuts.dashboard.image', section: 'dashboard', to: '/image-compress' },
  { id: 'dashboard.audio', keys: '4', labelKey: 'shortcuts.dashboard.audio', section: 'dashboard', to: '/audio-extract' },
  { id: 'dashboard.cut', keys: '5', labelKey: 'shortcuts.dashboard.cut', section: 'dashboard', to: '/video-cut' },
  { id: 'dashboard.batch', keys: '6', labelKey: 'shortcuts.dashboard.batch', section: 'dashboard', to: '/batch' },
];

/**
 * Registry lookup table mapping every shortcut id to its spec.
 * @const {Readonly<Record<string, HotkeySpec>>} SHORTCUT_BY_ID
 */
export const SHORTCUT_BY_ID: Readonly<Record<string, HotkeySpec>> = SHORTCUTS.reduce(
  (acc, spec) => {
    acc[spec.id] = spec;
    return acc;
  },
  {} as Record<string, HotkeySpec>,
);

/**
 * Whether the app is running on macOS. Used to map the 'Ctrl' token to the
 * Cmd (meta) key and to render platform-correct shortcut labels.
 * @type {boolean}
 */
export const IS_MAC: boolean = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || '');

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

/**
 * Normalizes a single key token to its `event.code` value.
 * Letters map to `Key<LETTER>`, digits to `Digit<DIGIT>`, and named tokens to
 * their standard code names. Unknown tokens are passed through uppercased.
 * @param {string} token - The key token from a chord, e.g. 'O', '3', 'Space'.
 * @returns {string} The corresponding `event.code` string.
 */
export function normalizeKeyToken(token: string): string {
  const upper = token.toUpperCase();
  if (/^[A-Z]$/.test(upper)) return `Key${upper}`;
  if (/^[0-9]$/.test(upper)) return `Digit${upper}`;
  const named: Record<string, string> = {
    SPACE: 'Space',
    ENTER: 'Enter',
    ESCAPE: 'Escape',
    ESC: 'Escape',
    BACKSPACE: 'Backspace',
    DELETE: 'Delete',
    TAB: 'Tab',
    HOME: 'Home',
    END: 'End',
    PAGEUP: 'PageUp',
    PAGEDOWN: 'PageDown',
    ARROWLEFT: 'ArrowLeft',
    ARROWRIGHT: 'ArrowRight',
    ARROWUP: 'ArrowUp',
    ARROWDOWN: 'ArrowDown',
    '/': 'Slash',
    SLASH: 'Slash',
  };
  return named[upper] ?? upper;
}

/**
 * Parses a canonical chord string into a matchable predicate.
 * Throws on chords that contain no key token (e.g. just 'Ctrl').
 * @param {string} chord - Chord in canonical form, e.g. 'Ctrl+Shift+S'.
 * @returns {ParsedShortcut} The parsed match predicate.
 */
export function parseShortcut(chord: string): ParsedShortcut {
  const parts = chord.split('+');
  let primary = false;
  let alt = false;
  let shift = false;
  const keyTokens: string[] = [];
  for (const part of parts) {
    switch (part) {
      case 'Ctrl':
        primary = true;
        break;
      case 'Alt':
        alt = true;
        break;
      case 'Shift':
        shift = true;
        break;
      default:
        keyTokens.push(part);
    }
  }
  if (keyTokens.length === 0) {
    throw new Error(`Invalid shortcut chord (no key token): ${chord}`);
  }
  return { primary, alt, shift, code: normalizeKeyToken(keyTokens.join('+')) };
}

/**
 * True when the platform primary modifier is down on the given event.
 * @param {KeyboardEvent} event - The key event to inspect.
 * @returns {boolean} True when Cmd is down on macOS or Ctrl is down elsewhere.
 */
function isPrimaryModifierDown(event: KeyboardEvent): boolean {
  return IS_MAC ? event.metaKey : event.ctrlKey;
}

/**
 * Tests a keyboard event against a parsed shortcut predicate. All modifiers are
 * matched exactly: modifiers held in the event but absent from the chord (and
 * vice versa) cause a mismatch, so 'Ctrl+O' never fires while Alt is also held.
 * @param {ParsedShortcut} parsed - The parsed chord predicate.
 * @param {KeyboardEvent} event - The keyboard event to test.
 * @returns {boolean} True when the event matches the chord exactly.
 */
export function shortcutMatches(parsed: ParsedShortcut, event: KeyboardEvent): boolean {
  if (event.code !== parsed.code) return false;
  if (parsed.primary !== isPrimaryModifierDown(event)) return false;
  if (parsed.alt !== event.altKey) return false;
  if (parsed.shift !== event.shiftKey) return false;
  return true;
}

/**
 * Formats a single key token for display (uppercase letters, arrow symbols,
 * '/' for the Slash key).
 * @param {string} token - The raw key token, e.g. 'O', 'ArrowLeft', 'Slash'.
 * @returns {string} The display form of the token.
 */
export function formatKeyToken(token: string): string {
  const display: Record<string, string> = {
    Space: 'Space',
    Slash: '/',
    Enter: 'Enter',
    Escape: 'Esc',
    Backspace: 'Backspace',
    Delete: 'Del',
    Tab: 'Tab',
    Home: 'Home',
    End: 'End',
    PageUp: 'PgUp',
    PageDown: 'PgDn',
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
  };
  return display[token] ?? token.toUpperCase();
}

/**
 * Formats a canonical chord into its display label, using platform-correct
 * modifier names and separators (⌘⌥⇧ on macOS, Ctrl+Alt+Shift on others).
 * @param {string} chord - The canonical chord, e.g. 'Ctrl+Shift+S'.
 * @returns {string} The display label, e.g. 'Ctrl+Shift+S' or '⌘⇧S'.
 */
export function formatShortcut(chord: string): string {
  const modifiers: Record<string, string> = IS_MAC ? { Ctrl: '⌘', Alt: '⌥', Shift: '⇧' } : { Ctrl: 'Ctrl', Alt: 'Alt', Shift: 'Shift' };
  const separator = IS_MAC ? '' : '+';
  return chord
    .split('+')
    .map((part) => modifiers[part] ?? formatKeyToken(part))
    .join(separator);
}

/**
 * Builds a localized tooltip/hint string combining an action label and its
 * shortcut, e.g. "Select input file (Ctrl+O)".
 * @param {(key: string) => string} t - The react-i18next `t` function.
 * @param {string} labelKey - i18n key of the action label.
 * @param {string} chord - Canonical chord of the shortcut.
 * @returns {string} The combined hint text.
 */
export function shortcutHint(t: (key: string) => string, labelKey: string, chord: string): string {
  return `${t(labelKey)} (${formatShortcut(chord)})`;
}
