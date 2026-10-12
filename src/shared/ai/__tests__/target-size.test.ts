/**
 * @fileoverview Unit tests for {@link planTargetSizeCandidates}.
 */

import { describe, it, expect } from 'vitest';
import { planTargetSizeCandidates } from '../target-size';
import type { MediaFacts } from '../types';

/** Facts for a 60 s, 10 MB H.264/AAC clip. */
const FACTS: MediaFacts = {
  file: 'C:/in.mp4',
  format: 'mov,mp4',
  sizeBytes: 10 * 1024 * 1024,
  durationSeconds: 60,
  overallBitrate: '1500k',
  hasVideo: true,
  hasAudio: true,
  subtitleCount: 0,
  video: { codec: 'h264', width: 1920, height: 1080, hdr: false, interlaced: false },
  audio: { codec: 'aac', channels: 2, bitrate: '128k' },
};

/** A 5 MB ceiling: (5*1024*1024*8/60)/1000 ≈ 699 kbps total. */
const FIVE_MB = 5 * 1024 * 1024;

describe('planTargetSizeCandidates', () => {
  it('derives the baseline from the ceiling, duration and audio budget', () => {
    const plan = planTargetSizeCandidates(FACTS, FIVE_MB);
    // 699.05 kbps total - 128 kbps audio = 571 kbps video
    expect(plan.baselineVideoKbps).toBe(571);
    expect(plan.audioBitrateKbps).toBe(128);
    expect(plan.targetBytes).toBe(FIVE_MB);
    expect(plan.isEstimated).toBe(true);
    expect(plan.method).toBe('bitrate');
  });

  it('orders candidates from highest quality to lowest', () => {
    const plan = planTargetSizeCandidates(FACTS, FIVE_MB);
    expect(plan.candidates).toHaveLength(3);
    const bitrates = plan.candidates.map((candidate) => candidate.videoBitrateKbps);
    expect(bitrates).toEqual([...bitrates].sort((a, b) => b - a));
    expect(plan.candidates[0].percentOfBaseline).toBeGreaterThanOrEqual(plan.candidates[1].percentOfBaseline);
  });

  it('honours maxCandidates and de-duplicates clamped rungs', () => {
    const one = planTargetSizeCandidates(FACTS, FIVE_MB, { maxCandidates: 1 });
    expect(one.candidates).toHaveLength(1);
    // A floor and ceiling meeting above every ladder rung collapses to one rung.
    const floored = planTargetSizeCandidates(FACTS, FIVE_MB, { videoFloorKbps: 700, videoCeilingKbps: 700, maxCandidates: 5 });
    expect(floored.candidates).toHaveLength(1);
    expect(floored.candidates[0].videoBitrateKbps).toBe(700);
  });

  it('clamps candidates to the configured ceiling', () => {
    const plan = planTargetSizeCandidates(FACTS, FIVE_MB, { videoCeilingKbps: 600, maxCandidates: 5 });
    for (const candidate of plan.candidates) {
      expect(candidate.videoBitrateKbps).toBeLessThanOrEqual(600);
    }
  });

  it('biases the ladder lower for a "smallest" intent', () => {
    const balanced = planTargetSizeCandidates(FACTS, FIVE_MB, { bias: 'balanced' });
    const size = planTargetSizeCandidates(FACTS, FIVE_MB, { bias: 'size' });
    expect(size.candidates[0].videoBitrateKbps).toBeLessThan(balanced.candidates[0].videoBitrateKbps);
  });

  it('drops the audio budget when the source has no audio', () => {
    const silent: MediaFacts = { ...FACTS, hasAudio: false, audio: undefined };
    const plan = planTargetSizeCandidates(silent, FIVE_MB);
    expect(plan.audioBitrateKbps).toBe(0);
    // (5*1024*1024*8/60)/1000 ≈ 699 kbps with no audio subtracted.
    expect(plan.baselineVideoKbps).toBe(699);
    for (const candidate of plan.candidates) {
      expect(candidate.audioBitrateKbps).toBe(0);
    }
  });

  it('returns no candidates for a file without video, with a note', () => {
    const audioOnly: MediaFacts = { ...FACTS, hasVideo: false, video: undefined };
    const plan = planTargetSizeCandidates(audioOnly, FIVE_MB);
    expect(plan.candidates).toEqual([]);
    expect(plan.notes.join(' ')).toContain('No video stream');
  });

  it('returns no candidates when the duration is unknown, with a note', () => {
    const unknown: MediaFacts = { ...FACTS, durationSeconds: 0 };
    const plan = planTargetSizeCandidates(unknown, FIVE_MB);
    expect(plan.candidates).toEqual([]);
    expect(plan.notes.join(' ')).toContain('duration is unknown');
  });

  it('returns no candidates for a non-positive ceiling', () => {
    const plan = planTargetSizeCandidates(FACTS, 0);
    expect(plan.candidates).toEqual([]);
    expect(plan.notes.join(' ')).toContain('positive byte ceiling');
  });
});
