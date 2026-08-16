/**
 * @fileoverview Unit tests for the keyboard-shortcut registry and chord
 * parsing/matching/formatting helpers in `constants/shortcuts.ts`.
 *
 * Covers registry integrity (unique ids, valid chords, valid sections, every
 * label key present in the base locale) and the pure parsing/matching/format
 * functions.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  SHORTCUTS,
  SHORTCUT_SECTIONS,
  SHORTCUT_BY_ID,
  normalizeKeyToken,
  parseShortcut,
  shortcutMatches,
  formatKeyToken,
  formatShortcut,
  shortcutHint,
} from '../shortcuts';

/**
 * Loads the base English locale so registry label keys can be verified against
 * the i18n payload the app actually ships.
 * @returns {Record<string, unknown>} The parsed en-US.json content.
 */
function loadBaseLocale(): Record<string, unknown> {
  const file = path.resolve(process.cwd(), 'src/renderer/i18n/locales/en-US.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Resolves a dotted i18n key against a parsed locale object.
 * @param {unknown} root - The parsed locale object.
 * @param {string} key - Dotted key, e.g. 'shortcuts.convert.start'.
 * @returns {unknown} The resolved value, or undefined when absent.
 */
function resolveKey(root: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => (acc as Record<string, unknown> | undefined)?.[part], root);
}

/**
 * Builds a KeyboardEvent with the given init overrides.
 * @param {KeyboardEventInit} init - The event properties.
 * @returns {KeyboardEvent} The constructed event.
 */
function keyEvent(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

describe('normalizeKeyToken', () => {
  it('maps letters to Key codes', () => {
    expect(normalizeKeyToken('O')).toBe('KeyO');
    expect(normalizeKeyToken('s')).toBe('KeyS');
  });

  it('maps digits to Digit codes', () => {
    expect(normalizeKeyToken('3')).toBe('Digit3');
  });

  it('maps named tokens to their standard codes', () => {
    expect(normalizeKeyToken('Space')).toBe('Space');
    expect(normalizeKeyToken('Enter')).toBe('Enter');
    expect(normalizeKeyToken('ArrowLeft')).toBe('ArrowLeft');
    expect(normalizeKeyToken('Slash')).toBe('Slash');
  });
});

describe('parseShortcut', () => {
  it('parses a plain modifier chord', () => {
    expect(parseShortcut('Ctrl+Shift+S')).toEqual({ primary: true, alt: false, shift: true, code: 'KeyS' });
  });

  it('parses alt navigation chords', () => {
    expect(parseShortcut('Alt+3')).toEqual({ primary: false, alt: true, shift: false, code: 'Digit3' });
  });

  it('parses bare keys with no modifiers', () => {
    expect(parseShortcut('L')).toEqual({ primary: false, alt: false, shift: false, code: 'KeyL' });
    expect(parseShortcut('Space')).toEqual({ primary: false, alt: false, shift: false, code: 'Space' });
  });

  it('parses the slash help chord', () => {
    expect(parseShortcut('Ctrl+/')).toEqual({ primary: true, alt: false, shift: false, code: 'Slash' });
  });

  it('throws when a chord has no key token', () => {
    expect(() => parseShortcut('Ctrl')).toThrow(/no key token/);
    expect(() => parseShortcut('Ctrl+Shift')).toThrow(/no key token/);
  });
});

describe('shortcutMatches', () => {
  it('matches when all modifiers and the code line up', () => {
    const parsed = parseShortcut('Ctrl+Shift+S');
    expect(shortcutMatches(parsed, keyEvent({ code: 'KeyS', ctrlKey: true, shiftKey: true }))).toBe(true);
  });

  it('rejects on a code mismatch', () => {
    const parsed = parseShortcut('Ctrl+Shift+S');
    expect(shortcutMatches(parsed, keyEvent({ code: 'KeyO', ctrlKey: true, shiftKey: true }))).toBe(false);
  });

  it('rejects when a required modifier is missing', () => {
    const parsed = parseShortcut('Ctrl+O');
    expect(shortcutMatches(parsed, keyEvent({ code: 'KeyO' }))).toBe(false);
    expect(shortcutMatches(parsed, keyEvent({ code: 'KeyO', ctrlKey: true, altKey: true }))).toBe(false);
  });

  it('rejects when an extra modifier is held (exact matching)', () => {
    const parsed = parseShortcut('Ctrl+O');
    expect(shortcutMatches(parsed, keyEvent({ code: 'KeyO', ctrlKey: true, shiftKey: true }))).toBe(false);
  });

  it('matches bare keys with no modifiers held', () => {
    const parsed = parseShortcut('L');
    expect(shortcutMatches(parsed, keyEvent({ code: 'KeyL' }))).toBe(true);
    expect(shortcutMatches(parsed, keyEvent({ code: 'KeyL', ctrlKey: true }))).toBe(false);
  });
});

describe('formatKeyToken / formatShortcut', () => {
  it('formats named tokens for display', () => {
    expect(formatKeyToken('ArrowLeft')).toBe('←');
    expect(formatKeyToken('ArrowRight')).toBe('→');
    expect(formatKeyToken('Slash')).toBe('/');
    expect(formatKeyToken('Space')).toBe('Space');
    expect(formatKeyToken('x')).toBe('X');
  });

  it('formats a chord for non-mac platforms', () => {
    expect(formatShortcut('Ctrl+Shift+S')).toBe('Ctrl+Shift+S');
    expect(formatShortcut('Ctrl+Enter')).toBe('Ctrl+Enter');
    expect(formatShortcut('Alt+7')).toBe('Alt+7');
    expect(formatShortcut('L')).toBe('L');
    expect(formatShortcut('Ctrl+/')).toBe('Ctrl+/');
  });

  it('builds a localized hint from a label key and chord', () => {
    const t = (key: string): string => key;
    expect(shortcutHint(t, 'convert.start', 'Ctrl+Enter')).toBe('convert.start (Ctrl+Enter)');
  });
});

describe('SHORTCUTS registry', () => {
  it('has unique ids', () => {
    const ids = SHORTCUTS.map((spec) => spec.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('maps every id through SHORTCUT_BY_ID', () => {
    for (const spec of SHORTCUTS) {
      expect(SHORTCUT_BY_ID[spec.id]).toBe(spec);
    }
  });

  it('parses every registered chord without throwing', () => {
    for (const spec of SHORTCUTS) {
      expect(() => parseShortcut(spec.keys), spec.id).not.toThrow();
    }
  });

  it('uses label keys under the shortcuts namespace', () => {
    for (const spec of SHORTCUTS) {
      expect(spec.labelKey).toMatch(/^shortcuts\./);
    }
  });

  it('lists every section in SHORTCUT_SECTIONS and gives each a spec', () => {
    for (const section of SHORTCUT_SECTIONS) {
      expect(
        SHORTCUTS.some((spec) => spec.section === section.id),
        section.id,
      ).toBe(true);
    }
    for (const spec of SHORTCUTS) {
      expect(
        SHORTCUT_SECTIONS.some((section) => section.id === spec.section),
        spec.id,
      ).toBe(true);
    }
  });

  it('resolves every section and action label in the base locale', () => {
    const enUS = loadBaseLocale();
    for (const section of SHORTCUT_SECTIONS) {
      expect(resolveKey(enUS, section.labelKey), section.labelKey).toBeTruthy();
    }
    for (const spec of SHORTCUTS) {
      expect(resolveKey(enUS, spec.labelKey), spec.labelKey).toBeTruthy();
    }
  });
});
