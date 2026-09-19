import { describe, it, expect } from 'vitest';
import {
  initialZoom,
  timeFromEvent,
  computeTimelineZoom,
  zoomCenterScrollLeft,
  computeRulerTicks,
  computeWaveformBars,
} from '../timeline-utils';

describe('initialZoom', () => {
  it('fits the full clip at the default width when short', () => {
    expect(initialZoom(60)).toBe(10);
    expect(initialZoom(30)).toBe(20);
  });

  it('clamps to the minimum zoom for long durations', () => {
    expect(initialZoom(600)).toBe(2);
  });

  it('clamps to the maximum zoom for very short clips', () => {
    expect(initialZoom(1)).toBe(300);
    expect(initialZoom(0.5)).toBe(300);
    expect(initialZoom(0)).toBe(300);
  });
});

describe('timeFromEvent', () => {
  it('converts a pointer offset to a media time', () => {
    expect(timeFromEvent(200, 50, 50, 100)).toBe(3);
  });

  it('clamps to the clip bounds', () => {
    expect(timeFromEvent(10, 50, 50, 100)).toBe(0);
    expect(timeFromEvent(5000, 0, 50, 100)).toBe(100);
  });

  it('handles zoom changes', () => {
    expect(timeFromEvent(100, 0, 100, 100)).toBe(1);
    expect(timeFromEvent(100, 0, 50, 100)).toBe(2);
  });
});

describe('computeTimelineZoom', () => {
  it('applies the multiplier', () => {
    expect(computeTimelineZoom(10, 1.5)).toBe(15);
    expect(computeTimelineZoom(15, 1 / 1.5)).toBeCloseTo(10);
  });

  it('clamps to the allowed range', () => {
    expect(computeTimelineZoom(2, 0.5)).toBe(2);
    expect(computeTimelineZoom(300, 2)).toBe(300);
  });
});

describe('zoomCenterScrollLeft', () => {
  it('centers the given time in the viewport', () => {
    expect(zoomCenterScrollLeft(10, 50, 400)).toBe(10 * 50 - 200);
  });

  it('floors at zero when the clip starts before the viewport center', () => {
    expect(zoomCenterScrollLeft(1, 50, 400)).toBe(0);
  });
});

describe('computeRulerTicks', () => {
  it('picks a step so ticks stay at least 50px apart', () => {
    const ticks = computeRulerTicks({ duration: 10, zoom: 25, scrollLeft: 0, viewportWidth: 300 });
    expect(ticks.step).toBe(2);
  });

  it('picks a large step for low zoom', () => {
    const ticks = computeRulerTicks({ duration: 600, zoom: 2, scrollLeft: 0, viewportWidth: 300 });
    expect(ticks.step).toBe(30);
  });

  it('emits major ticks across the visible range', () => {
    const ticks = computeRulerTicks({ duration: 10, zoom: 25, scrollLeft: 0, viewportWidth: 300 });
    expect(ticks.major).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('thins labels to respect the pixel gap', () => {
    const ticks = computeRulerTicks({ duration: 10, zoom: 25, scrollLeft: 0, viewportWidth: 300 });
    expect(ticks.labels).toEqual([0, 4, 8]);
  });

  it('adds minor sub-ticks only when there is room', () => {
    const spaced = computeRulerTicks({ duration: 10, zoom: 25, scrollLeft: 0, viewportWidth: 300 });
    expect(spaced.sub).toBe(0.4);
    expect(spaced.sub).toBe(spaced.step / 5);
    expect(spaced.minor).toHaveLength(20);
    for (const value of spaced.minor) {
      expect(Math.abs(value / spaced.step - Math.round(value / spaced.step))).toBeGreaterThan(1e-9);
    }

    const lowZoom = computeRulerTicks({ duration: 10, zoom: 3, scrollLeft: 0, viewportWidth: 300 });
    expect(lowZoom.step).toBe(30);
    expect(lowZoom.sub).toBe(6);
  });

  it('does not emit ticks past the clip duration', () => {
    const ticks = computeRulerTicks({ duration: 5, zoom: 25, scrollLeft: 0, viewportWidth: 300 });
    expect(Math.max(...ticks.major)).toBeLessThanOrEqual(5);
  });
});

const buckets = Array.from({ length: 100 }, (_, i) => ({ min: 0.1 * (i % 3), max: 0.5 + 0.1 * (i % 4) }));

describe('computeWaveformBars', () => {
  it('returns nothing for empty data or zero duration', () => {
    expect(
      computeWaveformBars({
        buckets: [],
        duration: 10,
        zoom: 60,
        scrollLeft: 0,
        viewportWidth: 600,
        trackContentHeight: 50,
        trackContentTop: 10,
      }),
    ).toEqual([]);
    expect(
      computeWaveformBars({
        buckets,
        duration: 0,
        zoom: 60,
        scrollLeft: 0,
        viewportWidth: 600,
        trackContentHeight: 50,
        trackContentTop: 10,
      }),
    ).toEqual([]);
  });

  it('renders one bar per bucket when buckets map one-to-one to slots', () => {
    const bars = computeWaveformBars({
      buckets,
      duration: 10,
      zoom: 60,
      scrollLeft: 0,
      viewportWidth: 600,
      trackContentHeight: 50,
      trackContentTop: 10,
    });
    expect(bars).toHaveLength(100);
    expect(bars[0].left).toBe(0);
    expect(bars[1].left).toBe(6);
    expect(bars[0].width).toBe(5);
    expect(bars[0].height).toBeGreaterThanOrEqual(2);
    expect(bars[0].top).toBeGreaterThanOrEqual(10);
  });

  it('aggregates several buckets per slot when slots are coarser', () => {
    const bars = computeWaveformBars({
      buckets,
      duration: 10,
      zoom: 6,
      scrollLeft: 0,
      viewportWidth: 60,
      trackContentHeight: 50,
      trackContentTop: 10,
    });
    expect(bars).toHaveLength(12);
    expect(bars[0].width).toBe(4);

    const first4 = buckets.slice(0, 9);
    const avgMax = first4.reduce((sum, b) => sum + b.max, 0) / first4.length;
    const avgPeak = first4.reduce((sum, b) => sum + (b.max - b.min) / 2, 0) / first4.length;
    expect(bars[0].height).toBe(Math.max(2, avgPeak * 50));
  });

  it('virtualizes to a scrolled viewport', () => {
    const bars = computeWaveformBars({
      buckets,
      duration: 10,
      zoom: 60,
      scrollLeft: 300,
      viewportWidth: 300,
      trackContentHeight: 50,
      trackContentTop: 10,
    });
    expect(bars.length).toBeGreaterThan(0);
    expect(bars.length).toBeLessThan(100);
    for (const bar of bars) expect(bar.left).toBeGreaterThanOrEqual(0);
  });
});
