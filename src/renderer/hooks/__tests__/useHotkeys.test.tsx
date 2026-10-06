/**
 * @fileoverview Unit tests for the `useHotkeys` hook.
 *
 * Renders small harness components to exercise the window keydown listener:
 * exact modifier matching, enabled flags, the interactive-target guard for bare
 * keys, repeat handling, preventDefault, first-match-wins, and listener cleanup
 * on unmount.
 */

import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useHotkeys } from '../useHotkeys';
import { expectAppLog } from '../../../test-utils/crash-tripwire';
import { SHORTCUTS, parseShortcut, type HotkeySpec, type ParsedShortcut } from '../../constants/shortcuts';

/**
 * Harness rendering the fired-count of a single bare-key binding.
 * @param {{ enabled?: boolean }} [props] - Optional enabled flag.
 * @returns {JSX.Element} The harness.
 */
function CountHarness({ enabled = true }: { enabled?: boolean }) {
  const [count, setCount] = useState(0);
  useHotkeys([{ id: 'convert.lossless', handler: () => setCount((n) => n + 1), enabled }]);
  return <span data-testid="count">{count}</span>;
}

/**
 * Fires a keydown event on `window` with the given init overrides.
 * @param {KeyboardEventInit} init - The event properties.
 * @returns {void}
 */
function pressWindow(init: KeyboardEventInit): void {
  fireEvent.keyDown(window, init);
}

describe('useHotkeys', () => {
  it('fires a bare-key binding on a matching chord', () => {
    render(<CountHarness />);
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    pressWindow({ code: 'KeyL', key: 'l' });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('does not fire when the chord does not match', () => {
    render(<CountHarness />);
    pressWindow({ code: 'KeyP', key: 'p' });
    pressWindow({ code: 'KeyL', key: 'l', ctrlKey: true });
    pressWindow({ code: 'KeyL', key: 'l', shiftKey: true });
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('fires a modifier chord and prevents the default action', () => {
    const onStart = vi.fn();
    function Harness() {
      useHotkeys([{ id: 'convert.start', handler: onStart }]);
      return null;
    }
    render(<Harness />);
    const event = new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter', ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);
    expect(onStart).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('respects an enabled=false binding without firing', () => {
    render(<CountHarness enabled={false} />);
    pressWindow({ code: 'KeyL', key: 'l' });
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('skips bare keys while focus is inside an interactive element', () => {
    const onLossless = vi.fn();
    function Harness() {
      useHotkeys([{ id: 'convert.lossless', handler: onLossless }]);
      return <input data-testid="input" />;
    }
    render(<Harness />);
    const input = screen.getByTestId('input');
    input.focus();
    fireEvent.keyDown(input, { code: 'KeyL', key: 'l' });
    expect(onLossless).not.toHaveBeenCalled();
  });

  it('still fires modifier chords while focus is inside an input', () => {
    const onStart = vi.fn();
    function Harness() {
      useHotkeys([{ id: 'convert.start', handler: onStart }]);
      return <input data-testid="input" />;
    }
    render(<Harness />);
    const input = screen.getByTestId('input');
    input.focus();
    fireEvent.keyDown(input, { code: 'Enter', key: 'Enter', ctrlKey: true });
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('skips auto-repeated events unless the binding allows repeats', () => {
    const onToggle = vi.fn();
    const onSeek = vi.fn();
    function Harness() {
      useHotkeys([
        { id: 'convert.lossless', handler: onToggle },
        { id: 'videoCut.seekForward', handler: onSeek, allowRepeat: true },
      ]);
      return null;
    }
    render(<Harness />);
    pressWindow({ code: 'KeyL', key: 'l', repeat: true });
    expect(onToggle).not.toHaveBeenCalled();
    pressWindow({ code: 'ArrowRight', key: 'ArrowRight', repeat: true });
    expect(onSeek).toHaveBeenCalledOnce();
  });

  it('fires the first matching binding only', () => {
    const first = vi.fn();
    const second = vi.fn();
    function Harness() {
      useHotkeys([
        { id: 'convert.lossless', handler: first },
        { id: 'videoCut.includeAudio', handler: second },
      ]);
      return null;
    }
    render(<Harness />);
    pressWindow({ code: 'KeyL', key: 'l' });
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
  });

  it('ignores bindings whose id is not in the registry', () => {
    expectAppLog('warn', 'renderer/hooks/useHotkeys');

    const handler = vi.fn();
    function Harness() {
      useHotkeys([{ id: 'does.not.exist', handler }]);
      return null;
    }
    render(<Harness />);
    pressWindow({ code: 'KeyL', key: 'l' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('removes the listener on unmount', () => {
    const onLossless = vi.fn();
    function Harness() {
      useHotkeys([{ id: 'convert.lossless', handler: onLossless }]);
      return null;
    }
    const { unmount } = render(<Harness />);
    pressWindow({ code: 'KeyL', key: 'l' });
    expect(onLossless).toHaveBeenCalledTimes(1);
    unmount();
    pressWindow({ code: 'KeyL', key: 'l' });
    expect(onLossless).toHaveBeenCalledTimes(1);
  });
});

/**
 * A canonical identity for a parsed chord, distinct when modifiers or the key
 * code differ.
 * @param {ParsedShortcut} parsed - The parsed chord.
 * @returns {string} The chord signature.
 */
function chordSignature(parsed: ParsedShortcut): string {
  return `${parsed.primary ? 1 : 0}${parsed.alt ? 1 : 0}${parsed.shift ? 1 : 0}${parsed.code}`;
}

/**
 * The `event.key` value a chord's key token corresponds to, for dispatching a
 * matching keyboard event.
 * @param {ParsedShortcut} parsed - The parsed chord.
 * @returns {string} The key value for the chord's code.
 */
function keyForChord(parsed: ParsedShortcut): string {
  if (parsed.code.startsWith('Key')) return parsed.code.slice(3).toLowerCase();
  if (parsed.code.startsWith('Digit')) return parsed.code.slice(5);
  const named: Record<string, string> = {
    Slash: '/',
    Space: ' ',
    Enter: 'Enter',
    Escape: 'Escape',
    ArrowLeft: 'ArrowLeft',
    ArrowRight: 'ArrowRight',
  };
  return named[parsed.code] ?? parsed.code;
}

/**
 * One spec per distinct parsed chord, first registration winning. Several
 * registry entries share a chord across sections; both the hook's
 * first-match-wins dispatch and these tests only ever exercise one of them.
 * @returns {Array<{spec: HotkeySpec; parsed: ParsedShortcut}>} Deduplicated chords.
 */
function uniqueChordSpecs(): Array<{ spec: HotkeySpec; parsed: ParsedShortcut }> {
  const bySignature = new Map<string, { spec: HotkeySpec; parsed: ParsedShortcut }>();
  for (const spec of SHORTCUTS) {
    const parsed = parseShortcut(spec.keys);
    const signature = chordSignature(parsed);
    if (!bySignature.has(signature)) bySignature.set(signature, { spec, parsed });
  }
  return [...bySignature.values()];
}

describe('useHotkeys registry-wide typing guard (row 5.3)', () => {
  it.each(['input', 'select', 'textarea'] as const)(
    'suppresses every bare-key registry chord while focus is inside a %s',
    (controlType) => {
      const bare = uniqueChordSpecs().filter(({ parsed }) => !parsed.primary && !parsed.alt);
      expect(bare.length, 'the registry should expose bare-key chords to guard').toBeGreaterThan(5);

      const spyById = new Map(bare.map(({ spec }) => [spec.id, vi.fn()]));
      function Harness() {
        useHotkeys(bare.map(({ spec }) => ({ id: spec.id, handler: spyById.get(spec.id)! })));
        if (controlType === 'select') {
          return (
            <select data-testid="field">
              <option>a</option>
            </select>
          );
        }
        if (controlType === 'textarea') return <textarea data-testid="field" />;
        return <input data-testid="field" />;
      }

      render(<Harness />);
      const field = screen.getByTestId('field');
      field.focus();

      for (const { parsed } of bare) {
        fireEvent.keyDown(field, {
          code: parsed.code,
          key: keyForChord(parsed),
          ctrlKey: parsed.primary,
          altKey: parsed.alt,
          shiftKey: parsed.shift,
        });
      }

      for (const [id, spy] of spyById) {
        expect(spy, `${id} fired while a ${controlType} had focus`).not.toHaveBeenCalled();
      }
    },
  );

  it('fires every modifier-chord registry binding while focus is inside a text input', () => {
    const modified = uniqueChordSpecs().filter(({ parsed }) => parsed.primary || parsed.alt);
    expect(modified.length, 'the registry should expose modifier chords to exercise').toBeGreaterThan(10);

    const spyById = new Map(modified.map(({ spec }) => [spec.id, vi.fn()]));
    function Harness() {
      useHotkeys(modified.map(({ spec }) => ({ id: spec.id, handler: spyById.get(spec.id)! })));
      return <input data-testid="field" />;
    }

    render(<Harness />);
    const field = screen.getByTestId('field');
    field.focus();

    for (const { spec, parsed } of modified) {
      fireEvent.keyDown(field, {
        code: parsed.code,
        key: keyForChord(parsed),
        ctrlKey: parsed.primary,
        altKey: parsed.alt,
        shiftKey: parsed.shift,
      });
      expect(spyById.get(spec.id), `${spec.id} did not fire inside a text input`).toHaveBeenCalledTimes(1);
    }
  });
});
