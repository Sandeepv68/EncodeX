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
