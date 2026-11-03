/**
 * @fileoverview Unit tests for {@link estimateConversion}.
 */

import { describe, it, expect } from 'vitest';
import type { EncoderCapabilities } from '../../types';
import { estimateConversion, detectHardwareAcceleration } from '../estimate';
import { extractMediaFacts } from '../media-facts';
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

/** Capabilities without hardware accelerators. */
const NO_HW: EncoderCapabilities = { videoEncoders: ['libx264', 'libx265'], audioEncoders: ['aac'], hwaccels: [] };

/** Capabilities with a hardware encoder. */
const WITH_HW: EncoderCapabilities = { videoEncoders: ['h264_nvenc', 'libx264'], audioEncoders: ['aac'], hwaccels: ['cuda'] };

/**
 * Facts without any bitrate information, so the estimator cannot run its
 * model and has to fall back to the default bitrate scaled by the resolution.
 */
const BARE: MediaFacts = {
  ...FACTS,
  overallBitrate: undefined,
  sizeBytes: 0,
  durationSeconds: 0,
  hasAudio: false,
  audio: undefined,
};

describe('estimateConversion', () => {
  it('computes size from bitrates and duration', () => {
    const estimate = estimateConversion({ videoBitrate: '2000k', audioBitrate: '128k' }, FACTS, NO_HW);
    // (2000 + 128) kbps * 1000 / 8 * 60 s = 15,960,000 bytes
    expect(estimate.estimatedSizeBytes).toBe(15960000);
    expect(estimate.method).toBe('bitrate');
    expect(estimate.isEstimated).toBe(true);
  });

  it('honours a trim duration and flags the trim', () => {
    const estimate = estimateConversion({ videoBitrate: '1000k', audioBitrate: '128k', duration: '30' }, FACTS, NO_HW);
    expect(estimate.estimatedDurationSeconds).toBe(30);
    expect(estimate.estimatedSizeBytes).toBe(Math.round(((1000 + 128) * 1000 * 30) / 8));
    expect(estimate.notes.join(' ')).toContain('Trimmed to 30s');
  });

  it('reports stream copy as preserving the source size', () => {
    const estimate = estimateConversion({ copy: true }, FACTS, NO_HW);
    expect(estimate.copy).toBe(true);
    expect(estimate.estimatedSizeBytes).toBe(FACTS.sizeBytes);
    expect(estimate.notes.join(' ')).toContain('stream copy');
  });

  it('models the target bitrate when the plan carries no target bitrate', () => {
    const estimate = estimateConversion({}, FACTS, NO_HW);
    // The model anchors on the output resolution, the frame rate and the
    // quality target instead of the source bitrate: a quality target is an
    // absolute quality, so the source bitrate only adjusts for the content
    // complexity. The source audio is not counted into the video part.
    expect(estimate.videoBitrateKbps).toBeGreaterThan(0);
    expect(estimate.audioBitrateKbps).toBe(128);
    expect(estimate.notes.join(' ')).toContain('No target video bitrate');
  });

  it('models a smaller bitrate for a smaller output resolution', () => {
    const full = estimateConversion({}, FACTS, NO_HW);
    const half = estimateConversion({ scale: '1280x720' }, FACTS, NO_HW);
    expect(half.videoBitrateKbps).toBeLessThan(full.videoBitrateKbps);
  });

  it('never lets an upscale inflate the estimate', () => {
    const plain = estimateConversion({}, FACTS, NO_HW);
    const upscale = estimateConversion({ scale: '3840x2160' }, FACTS, NO_HW);
    expect(upscale.videoBitrateKbps).toBe(plain.videoBitrateKbps);
  });

  it('accounts for the codec efficiency', () => {
    const h264 = estimateConversion({ videoCodec: 'libx264' }, FACTS, NO_HW);
    const hevc = estimateConversion({ videoCodec: 'libx265' }, FACTS, NO_HW);
    expect(hevc.videoBitrateKbps).toBeLessThan(h264.videoBitrateKbps);
  });

  it('accounts for the quality target', () => {
    const high = estimateConversion({ qscale: 18 }, FACTS, NO_HW);
    const low = estimateConversion({ qscale: 26 }, FACTS, NO_HW);
    expect(low.videoBitrateKbps).toBeLessThan(high.videoBitrateKbps);
  });

  it('keeps the source audio bitrate when no target is given', () => {
    const facts: MediaFacts = { ...FACTS, audio: { codec: 'aac', channels: 2, bitrate: '320k' } };
    const estimate = estimateConversion({}, facts, NO_HW);
    expect(estimate.audioBitrateKbps).toBe(320);
  });

  it('reports a saving for a high-bitrate source that keeps its resolution', () => {
    // A 720p source encoded far above the target quality: re-encoding it with
    // the target's quality shrinks it even though the resolution is unchanged.
    const facts: MediaFacts = {
      ...FACTS,
      sizeBytes: 700 * 1024 * 1024,
      durationSeconds: 600,
      overallBitrate: '9800k',
      video: { codec: 'h264', width: 1280, height: 720, frameRate: '30/1', hdr: false, interlaced: false },
    };
    const estimate = estimateConversion({ qscale: 20 }, facts, NO_HW);
    expect(estimate.estimatedSizeBytes).toBeLessThan(facts.sizeBytes);
  });

  it('reports a saving for facts built from a real probe', () => {
    // Regression: ffprobe reports bits per second, and feeding those values to
    // the estimator unconverted saturated its complexity factor, which made
    // every plan estimate the same size and report a 0% saving.
    const facts = extractMediaFacts({
      file: 'C:/media/movie.mkv',
      format: 'matroska,webm',
      size: 700 * 1024 * 1024,
      duration: 600,
      bitrate: '9808000',
      streams: [
        { index: 0, type: 'video', codec: 'h264', width: 1280, height: 720, frameRate: '30.00', bitrate: '9680000' },
        { index: 1, type: 'audio', codec: 'aac', channels: 2, bitrate: '128000' },
      ],
    });
    const estimate = estimateConversion({ scale: '1280x720', qscale: 20, videoCodec: 'libx264', audioBitrate: '128k' }, facts, NO_HW);
    expect(estimate.estimatedSizeBytes).toBeLessThan(facts.sizeBytes * 0.6);
  });

  it('notes when it falls back to a default bitrate', () => {
    const bare: MediaFacts = { ...FACTS, overallBitrate: undefined, sizeBytes: 0, durationSeconds: 0 };
    const estimate = estimateConversion({}, bare, NO_HW);
    expect(estimate.videoBitrateKbps).toBeGreaterThan(0);
    expect(estimate.notes.join(' ')).toContain('No target video bitrate');
  });

  it('surfaces hardware-encoder availability', () => {
    const estimate = estimateConversion({ videoBitrate: '2000k' }, FACTS, WITH_HW);
    expect(estimate.hardwareAcceleration.available).toBe(true);
    expect(estimate.notes.join(' ')).toContain('Hardware encoding is available');
  });

  it('drops audio from the estimate when audio is disabled', () => {
    const estimate = estimateConversion({ videoBitrate: '2000k', audio: false }, FACTS, NO_HW);
    expect(estimate.audioBitrateKbps).toBe(0);
    expect(estimate.estimatedSizeBytes).toBe(Math.round((2000 * 1000 * 60) / 8));
  });

  it('scales the modelled bitrate by a percentage scale', () => {
    const full = estimateConversion({}, FACTS, NO_HW);
    const half = estimateConversion({ scale: '50%' }, FACTS, NO_HW);
    expect(half.videoBitrateKbps).toBeLessThan(full.videoBitrateKbps);
  });

  it('scales the fallback bitrate by an explicit resolution', () => {
    // Without a source bitrate the model cannot run, so the fallback scales the
    // default bitrate by the ratio between the output and the source pixels.
    const full = estimateConversion({}, BARE, NO_HW);
    const half = estimateConversion({ scale: '1280x720' }, BARE, NO_HW);
    expect(half.videoBitrateKbps).toBeLessThan(full.videoBitrateKbps);
  });

  it('scales the fallback bitrate by a percentage scale', () => {
    const full = estimateConversion({}, BARE, NO_HW);
    const half = estimateConversion({ scale: '50%' }, BARE, NO_HW);
    expect(half.videoBitrateKbps).toBeLessThan(full.videoBitrateKbps);
  });

  it('accepts a quality target given as a string', () => {
    const numeric = estimateConversion({ qscale: 20 }, FACTS, NO_HW);
    const textual = estimateConversion({ qscale: '20' }, FACTS, NO_HW);
    expect(textual.videoBitrateKbps).toBe(numeric.videoBitrateKbps);
  });
});

describe('detectHardwareAcceleration', () => {
  it('detects known hardware markers in encoders and hwaccels', () => {
    expect(detectHardwareAcceleration(WITH_HW)).toEqual({ available: true, methods: ['cuda', 'h264_nvenc'] });
    expect(detectHardwareAcceleration(NO_HW)).toEqual({ available: false, methods: [] });
  });
});
