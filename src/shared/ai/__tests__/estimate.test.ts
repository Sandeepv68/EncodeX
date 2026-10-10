/**
 * @fileoverview Unit tests for {@link estimateConversion}.
 */

import { describe, it, expect } from 'vitest';
import type { EncoderCapabilities } from '../../types';
import { estimateConversion, detectHardwareAcceleration } from '../estimate';
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

  it('falls back to the source bitrate when none is requested', () => {
    const estimate = estimateConversion({}, FACTS, NO_HW);
    expect(estimate.videoBitrateKbps).toBe(1500);
  });

  it('notes when it falls back to a default bitrate', () => {
    const bare: MediaFacts = { ...FACTS, overallBitrate: undefined, sizeBytes: 0, durationSeconds: 0 };
    const estimate = estimateConversion({}, bare, NO_HW);
    expect(estimate.videoBitrateKbps).toBe(2500);
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
});

describe('detectHardwareAcceleration', () => {
  it('detects known hardware markers in encoders and hwaccels', () => {
    expect(detectHardwareAcceleration(WITH_HW)).toEqual({ available: true, methods: ['cuda', 'h264_nvenc'] });
    expect(detectHardwareAcceleration(NO_HW)).toEqual({ available: false, methods: [] });
  });
});
