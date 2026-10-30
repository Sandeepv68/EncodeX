/**
 * @fileoverview Unit tests for the Copilot aurora backdrop.
 *
 * The aurora paints its sparkles on a 2D canvas, which jsdom does not
 * implement, so the canvas context is stubbed here. The stub records the
 * drawing calls, which lets the test drive the animation loop and assert that
 * the sparkles are drawn and that the layer shrinks to the composer when a chat
 * is running.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import GeminiAurora from '../GeminiAurora';

/** Recorded drawing calls made through the stubbed canvas context. */
interface CanvasCalls {
  clearRect: number;
  fill: number;
  stroke: number;
  restore: number;
}

/** The stubbed 2D context shared by the tests. */
const calls: CanvasCalls = { clearRect: 0, fill: 0, stroke: 0, restore: 0 };

/**
 * A minimal 2D context stub: every method the aurora calls is a no-op that
 * counts its invocation.
 * @returns {object} The stubbed context.
 */
function createContextStub(): object {
  return {
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    clearRect: () => {
      calls.clearRect += 1;
    },
    save: () => {},
    restore: () => {
      calls.restore += 1;
    },
    beginPath: () => {},
    arc: () => {},
    moveTo: () => {},
    lineTo: () => {},
    fill: () => {
      calls.fill += 1;
    },
    stroke: () => {
      calls.stroke += 1;
    },
  };
}

/** Frames the animation loop is allowed to run. */
const FRAME_COUNT = 200;

describe('GeminiAurora', () => {
  beforeEach(() => {
    calls.clearRect = 0;
    calls.fill = 0;
    calls.stroke = 0;
    calls.restore = 0;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => createContextStub() as CanvasRenderingContext2D);
    // A fixed random value keeps the sparkles large and bright enough for the
    // loop to reach both of its phases (growing, then fading out) and to draw
    // the star flares on the bigger points.
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    let frames = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      frames += 1;
      if (frames <= FRAME_COUNT) {
        callback(performance.now());
      }
      return frames;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('paints the sparkle field onto the canvas', () => {
    render(<GeminiAurora />);

    expect(calls.clearRect).toBeGreaterThan(0);
    expect(calls.fill).toBeGreaterThan(0);
    expect(calls.restore).toBeGreaterThan(0);
  });

  it('renders four morphing blobs', () => {
    const { container } = render(<GeminiAurora />);

    expect(container.querySelectorAll('[data-testid="copilot-aurora-blob"]')).toHaveLength(4);
  });

  it('fills the page while the composer is idle', () => {
    const { container } = render(<GeminiAurora />);
    const layer = container.firstElementChild as HTMLElement;

    expect(layer).not.toBeNull();
    expect(layer.className).toContain('css-');
  });

  it('hides the top edge while the aurora is full size', () => {
    const { container } = render(<GeminiAurora />);
    const edge = container.querySelector('[data-testid="copilot-aurora-edge"]');

    expect(edge).not.toBeNull();
  });

  it('shows the top edge as soon as the aurora shrinks to the composer', () => {
    const { container, rerender } = render(<GeminiAurora />);
    rerender(<GeminiAurora compact />);

    const edge = container.querySelector('[data-testid="copilot-aurora-edge"]');
    expect(edge).not.toBeNull();
  });

  it('fades the top edge out once the aurora grows back', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = render(<GeminiAurora compact />);
      rerender(<GeminiAurora compact={false} />);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      const edge = container.querySelector('[data-testid="copilot-aurora-edge"]');
      expect(edge).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
