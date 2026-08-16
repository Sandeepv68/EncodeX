/**
 * @fileoverview Global keyboard shortcut hook.
 *
 * Registers a single `keydown` listener on `window` for the lifetime of the
 * component and matches every event against the bindings passed in, using the
 * registry and match logic from `constants/shortcuts.ts`. Page-scoped bindings
 * (passing a different binding list per render) are supported: the hook keeps
 * the latest list in a ref so handlers and `enabled` flags are always current
 * without re-binding the listener.
 *
 * Matching rules (see constants/shortcuts.ts for the chord parser):
 *  - Modifiers are matched exactly ('Ctrl+O' never fires while Alt is held).
 *  - 'Ctrl' maps to the platform primary modifier (Cmd on macOS).
 *  - Bare keys (no Ctrl/Alt modifier) are ignored while the event target is an
 *    interactive element (inputs, buttons, role widgets, contenteditable), so
 *    typing or operating a focused control is never hijacked. Modifier chords
 *    (e.g. 'Ctrl+O') are deliberately allowed inside inputs.
 *  - Auto-repeated keydown events are skipped unless a binding opts in with
 *    `allowRepeat` (used for hold-to-repeat actions such as seek arrows).
 *  - Matched events call `preventDefault()` so chords don't trigger any
 *    browser default behavior.
 *
 * @example
 * useHotkeys([
 *   { id: 'convert.start', handler: () => startConversion(), enabled: !isConverting },
 *   { id: 'convert.lossless', handler: () => setCopyMode((v) => !v) },
 * ]);
 */

import { useEffect, useRef } from 'react';
import { Logger } from '../../shared/logger';
import {
  LOG_HOTKEY_MATCHED,
  LOG_HOTKEY_SKIPPED_DISABLED,
  LOG_HOTKEY_SKIPPED_INTERACTIVE,
  LOG_HOTKEY_SKIPPED_REPEAT,
  LOG_HOTKEY_UNKNOWN_ID,
} from '../../shared/log-constants';
import { SHORTCUT_BY_ID, parseShortcut, shortcutMatches, type ParsedShortcut } from '../constants/shortcuts';

/**
 * Logger instance scoped to the useHotkeys module.
 * @type {Logger}
 */
const log = new Logger('renderer/hooks/useHotkeys');

/**
 * One shortcut binding registered by a component.
 * @interface HotkeyBinding
 * @property {string} id - Id of the shortcut spec in the registry; the spec
 *   supplies the chord and label.
 * @property {(event: KeyboardEvent) => void} handler - Invoked when the chord
 *   is pressed (and `enabled` is true). Receives the raw keyboard event.
 * @property {boolean} [enabled] - When false the binding is ignored for that
 *   keypress (but stays registered); defaults to true.
 * @property {boolean} [allowRepeat] - When true the binding also fires on
 *   auto-repeating keydown events (hold to repeat); defaults to false.
 */
export interface HotkeyBinding {
  id: string;
  handler: (event: KeyboardEvent) => void;
  enabled?: boolean;
  allowRepeat?: boolean;
}

/**
 * Selector string describing targets considered "interactive" for the bare-key
 * guard. Bare shortcuts (e.g. 'L', 'Space') are suppressed while focus is on
 * any of these so they never interfere with typing or widget operation.
 * @const {string} INTERACTIVE_TARGET_SELECTOR
 */
const INTERACTIVE_TARGET_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="slider"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="link"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="option"]',
  '[role="spinbutton"]',
  '[role="searchbox"]',
  '[role="textbox"]',
].join(',');

/**
 * True when the event target is an interactive element whose native keyboard
 * behavior must win over bare-key shortcuts.
 * @param {EventTarget | null} target - The keydown event target.
 * @returns {boolean} True when the target (or an ancestor) is interactive.
 */
function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return true;
  return target.closest(INTERACTIVE_TARGET_SELECTOR) !== null;
}

/**
 * Module-level cache of parsed chords so repeated lookups in hot loops are
 * cheap; registry chords are static strings.
 * @const {Map<string, ParsedShortcut>} parsedCache
 */
const parsedCache = new Map<string, ParsedShortcut>();

/**
 * Returns the parsed predicate for a chord, cached after first use.
 * @param {string} chord - The canonical chord string.
 * @returns {ParsedShortcut} The cached parsed predicate.
 */
function getParsed(chord: string): ParsedShortcut {
  let parsed = parsedCache.get(chord);
  if (!parsed) {
    parsed = parseShortcut(chord);
    parsedCache.set(chord, parsed);
  }
  return parsed;
}

/**
 * Wires the given bindings to a single window keydown listener.
 *
 * The listener is attached once on mount and removed on unmount; the binding
 * list itself is stored in a ref updated on every render, so callers can pass
 * a fresh array (with current handlers/enabled flags) without cost. Bindings
 * are evaluated in array order and the first match wins, which lets callers
 * express precedence.
 *
 * @param {readonly HotkeyBinding[]} bindings - The shortcut bindings to
 *   register for this component's lifetime.
 * @returns {void}
 */
export function useHotkeys(bindings: readonly HotkeyBinding[]): void {
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useEffect(() => {
    /**
     * Routes a keydown event through the current bindings. The first binding
     * whose chord matches (exact modifiers, code match, not repeated unless
     * allowed, not blocked by the interactive-target guard) is fired and the
     * event's default is prevented.
     * @param {KeyboardEvent} event - The window keydown event.
     * @returns {void}
     */
    const onKeyDown = (event: KeyboardEvent) => {
      for (const binding of bindingsRef.current) {
        const spec = SHORTCUT_BY_ID[binding.id];
        if (!spec) {
          log.warn(LOG_HOTKEY_UNKNOWN_ID, binding.id);
          continue;
        }
        const parsed = getParsed(spec.keys);
        if (!shortcutMatches(parsed, event)) continue;
        if (binding.enabled === false) {
          log.debug(LOG_HOTKEY_SKIPPED_DISABLED, binding.id, spec.keys);
          continue;
        }
        if (event.repeat && !binding.allowRepeat) {
          log.debug(LOG_HOTKEY_SKIPPED_REPEAT, binding.id, spec.keys);
          continue;
        }
        if (!parsed.primary && !parsed.alt && isInteractiveTarget(event.target)) {
          log.debug(LOG_HOTKEY_SKIPPED_INTERACTIVE, binding.id, spec.keys, event.code);
          continue;
        }
        log.debug(LOG_HOTKEY_MATCHED, binding.id, spec.keys);
        event.preventDefault();
        binding.handler(event);
        break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
