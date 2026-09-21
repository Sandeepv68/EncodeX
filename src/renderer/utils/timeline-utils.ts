/**
 * @fileoverview Pure timeline geometry helpers for the video-cutting timeline.
 *
 * Houses the DOM-free math that `VideoTimeline` inlines: initial zoom auto-fit,
 * pointer-X → media-time conversion, zoom-around-center scroll math, ruler
 * tick/label selection, and waveform bar envelope aggregation. All functions
 * take numbers/structs in and return numbers/structs out — no element or ref
 * access, so they are trivially unit-testable.
 */

import { clamp } from '../../shared/math';
import {
  DEFAULT_TIMELINE_WIDTH,
  TIMELINE_MIN_ZOOM,
  TIMELINE_MAX_ZOOM,
  TIMELINE_RULER_MIN_TICK_PX,
  TIMELINE_LABEL_MIN_GAP,
  TIMELINE_MIN_BAR_PITCH,
  TIMELINE_TICK_STEPS,
} from '../../shared/constants';

/**
 * Computes the initial zoom level (pixels per second) that fits the full clip
 * at the default timeline width, clamped to the allowed zoom range.
 * @param {number} duration - Clip duration in seconds.
 * @returns {number} Initial zoom in pixels per second.
 */
export function initialZoom(duration: number): number {
  return clamp(DEFAULT_TIMELINE_WIDTH / Math.max(duration, 1), TIMELINE_MIN_ZOOM, TIMELINE_MAX_ZOOM);
}

/**
 * Converts a pointer client X position into a media time by offsetting it from
 * the scroller's left edge and dividing by the current zoom.
 * @param {number} clientX - Pointer X coordinate relative to the viewport.
 * @param {number} rectLeft - Left edge of the scroller element.
 * @param {number} zoom - Current zoom in pixels per second.
 * @param {number} duration - Clip duration in seconds.
 * @returns {number} Time in seconds clamped to [0, duration].
 */
export function timeFromEvent(clientX: number, rectLeft: number, zoom: number, duration: number): number {
  return clamp((clientX - rectLeft) / zoom, 0, duration);
}

/**
 * Computes the next zoom level after applying a multiplier, clamped to the
 * allowed zoom range.
 * @param {number} zoom - Current zoom in pixels per second.
 * @param {number} factor - Zoom multiplier (e.g. TIMELINE_ZOOM_STEP zooms in,
 *   its reciprocal zooms out).
 * @returns {number} The clamped next zoom level.
 */
export function computeTimelineZoom(zoom: number, factor: number): number {
  return clamp(zoom * factor, TIMELINE_MIN_ZOOM, TIMELINE_MAX_ZOOM);
}

/**
 * Computes the viewport scroll offset that centers the given media time after
 * a zoom change.
 * @param {number} centerTime - Media time under the viewport center.
 * @param {number} zoom - New zoom level in pixels per second.
 * @param {number} clientWidth - Viewport width in pixels.
 * @returns {number} The scroll-left offset, floored at 0.
 */
export function zoomCenterScrollLeft(centerTime: number, zoom: number, clientWidth: number): number {
  return Math.max(0, centerTime * zoom - clientWidth / 2);
}

/**
 * Resolved ruler tick layout for a visible time range.
 * @interface RulerTicks
 * @property {number} step - Major tick interval in seconds.
 * @property {number} sub - Minor sub-tick interval in seconds (0 when no room).
 * @property {number[]} major - Major tick time values (seconds).
 * @property {number[]} minor - Minor sub-tick time values that do not coincide
 *   with major ticks.
 * @property {number[]} labels - Major tick values that pass the label-gap test.
 */
export interface RulerTicks {
  step: number;
  sub: number;
  major: number[];
  minor: number[];
  labels: number[];
}

/**
 * Computes the ruler tick/label layout for the visible time range. The major
 * tick step is chosen so ticks stay at least `minTickPx` apart; labels are
 * dropped when they would land too close to the previous one; minor
 * subdivisions are added only when they keep at least 5px spacing.
 * @param {Object} args - Geometry inputs.
 * @param {number} args.duration - Clip duration in seconds.
 * @param {number} args.zoom - Current zoom in pixels per second.
 * @param {number} args.scrollLeft - Viewport scroll offset in pixels.
 * @param {number} args.viewportWidth - Viewport width in pixels.
 * @param {number} [args.minTickPx] - Minimum major-tick pixel spacing.
 * @param {number} [args.labelMinGap] - Minimum pixel gap between labels.
 * @param {readonly number[]} [args.tickSteps] - Candidate major tick intervals.
 * @returns {RulerTicks} The resolved tick layout.
 */
export function computeRulerTicks(args: {
  duration: number;
  zoom: number;
  scrollLeft: number;
  viewportWidth: number;
  minTickPx?: number;
  labelMinGap?: number;
  tickSteps?: readonly number[];
}): RulerTicks {
  const {
    duration,
    zoom,
    scrollLeft,
    viewportWidth,
    minTickPx = TIMELINE_RULER_MIN_TICK_PX,
    labelMinGap = TIMELINE_LABEL_MIN_GAP,
    tickSteps = TIMELINE_TICK_STEPS,
  } = args;
  const step = tickSteps.find((candidate) => candidate * zoom >= minTickPx) ?? tickSteps[tickSteps.length - 1];
  const margin = viewportWidth / zoom / 2;
  const startTime = Math.max(0, scrollLeft / zoom - margin);
  const endTime = Math.min(duration, (scrollLeft + viewportWidth) / zoom + margin);

  const major: number[] = [];
  const labels: number[] = [];
  let lastLabelX = -Infinity;
  const firstMajor = Math.max(0, Math.floor(startTime / step) * step);
  for (let value = firstMajor; value <= endTime + 1e-9; value += step) {
    major.push(value);
    const x = value * zoom;
    if (x - lastLabelX >= labelMinGap) {
      lastLabelX = x;
      labels.push(value);
    }
  }

  let sub = 0;
  if ((step * zoom) / 5 >= 5) sub = step / 5;
  else if ((step * zoom) / 2 >= 5) sub = step / 2;
  const minor: number[] = [];
  if (sub > 0) {
    const firstMinor = Math.max(0, Math.floor(startTime / sub) * sub);
    for (let value = firstMinor; value <= endTime + 1e-9; value += sub) {
      if (Math.abs(value / step - Math.round(value / step)) > 1e-9) {
        minor.push(value);
      }
    }
  }

  return { step, sub, major, minor, labels };
}

/**
 * Geometry of a single waveform bar.
 * @interface WaveformBarGeometry
 * @property {number} left - Left offset in pixels.
 * @property {number} top - Top offset in pixels.
 * @property {number} width - Bar width in pixels.
 * @property {number} height - Bar height in pixels.
 */
export interface WaveformBarGeometry {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Computes the visible waveform bar geometry, virtualized to the viewport.
 * When several buckets map to one on-screen slot they are aggregated by
 * averaging the peak and max amplitudes; each bar is positioned and sized from
 * its min/max envelope, clamped to the track content area.
 * @param {Object} args - Geometry inputs.
 * @param {Array<{min: number; max: number}>} args.buckets - Amplitude buckets.
 * @param {number} args.duration - Clip duration in seconds.
 * @param {number} args.zoom - Current zoom in pixels per second.
 * @param {number} args.scrollLeft - Viewport scroll offset in pixels.
 * @param {number} args.viewportWidth - Viewport width in pixels (0 disables
 *   virtualization).
 * @param {number} [args.minBarPitch] - Minimum pixel pitch between bars.
 * @param {number} args.trackContentHeight - Height of the waveform track
 *   content area in pixels.
 * @param {number} args.trackContentTop - Top offset of the waveform track
 *   content area in pixels.
 * @returns {WaveformBarGeometry[]} Bar geometries for the visible range.
 */
export function computeWaveformBars(args: {
  buckets: Array<{ min: number; max: number }>;
  duration: number;
  zoom: number;
  scrollLeft: number;
  viewportWidth: number;
  minBarPitch?: number;
  trackContentHeight: number;
  trackContentTop: number;
}): WaveformBarGeometry[] {
  const {
    buckets,
    duration,
    zoom,
    scrollLeft,
    viewportWidth,
    minBarPitch = TIMELINE_MIN_BAR_PITCH,
    trackContentHeight,
    trackContentTop,
  } = args;
  if (buckets.length === 0 || duration <= 0) return [];

  const totalWidth = duration * zoom;
  const bucketWidth = totalWidth / buckets.length;
  const slotWidth = Math.max(bucketWidth, minBarPitch);
  const barWidth = Math.max(2, slotWidth - 1);
  const barHeight = trackContentHeight;
  const envelopeTop = trackContentTop;
  const virtualize = viewportWidth > 0;
  const margin = virtualize ? viewportWidth / zoom / 2 : 0;
  const startTime = virtualize ? Math.max(0, scrollLeft / zoom - margin) : 0;
  const endTime = virtualize ? Math.min(duration, (scrollLeft + viewportWidth) / zoom + margin) : duration;
  const bucketsPerSlot = slotWidth / bucketWidth;

  const pushBar = (left: number, bucket: { min: number; max: number }): WaveformBarGeometry => {
    const topFraction = (1 - bucket.max) / 2;
    const heightFraction = Math.max(0, bucket.max - bucket.min) / 2;
    const height = Math.max(2, heightFraction * barHeight);
    const top = Math.max(envelopeTop, Math.min(envelopeTop + barHeight - height, envelopeTop + topFraction * barHeight));
    return { left, top, width: barWidth, height };
  };

  const bars: WaveformBarGeometry[] = [];
  const firstSlot = Math.max(0, Math.floor((startTime * zoom) / slotWidth));
  const lastSlot = Math.min(Math.ceil(totalWidth / slotWidth) - 1, Math.ceil((endTime * zoom) / slotWidth));
  for (let slot = firstSlot; slot <= lastSlot; slot++) {
    const left = slot * slotWidth;
    const i0 = Math.min(buckets.length - 1, Math.max(0, Math.floor(slot * bucketsPerSlot)));
    const i1 = Math.min(buckets.length - 1, Math.max(0, Math.ceil((slot + 1) * bucketsPerSlot) - 1));
    if (bucketsPerSlot <= 1.001) {
      bars.push(pushBar(left, buckets[i0]));
    } else {
      let peakSum = 0;
      let maxSum = 0;
      for (let i = i0; i <= i1; i++) {
        const b = buckets[i];
        peakSum += (b.max - b.min) / 2;
        maxSum += b.max;
      }
      const count = i1 - i0 + 1;
      const avgMax = maxSum / count;
      const avgPeak = peakSum / count;
      bars.push(pushBar(left, { min: avgMax - avgPeak * 2, max: avgMax }));
    }
  }
  return bars;
}
