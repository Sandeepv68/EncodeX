/**
 * @fileoverview Unit tests for the rules-based recommender.
 */

import { describe, it, expect } from 'vitest';
import { BUILTIN_PROFILES } from '../../profiles/builtin';
import type { EncoderCapabilities } from '../../types';
import type { MediaFacts, PlanRequest } from '../types';
import { recommendSettings, parseIntent, selectProfile, codecFamily } from '../recommend';

/** 1080p H.264/AAC source facts. */
const FACTS: MediaFacts = {
  file: 'C:/media/movie.mkv',
  format: 'matroska,webm',
  sizeBytes: 500 * 1024 * 1024,
  durationSeconds: 600,
  overallBitrate: '6000k',
  hasVideo: true,
  hasAudio: true,
  subtitleCount: 0,
  video: { codec: 'h264', width: 1920, height: 1080, hdr: false, interlaced: false },
  audio: { codec: 'aac', channels: 2, bitrate: '192k' },
};

/** Bare capabilities. */
const CAPS: EncoderCapabilities = { videoEncoders: ['libx264', 'libx265'], audioEncoders: ['aac'], hwaccels: [] };

/**
 * Builds a plan request over the built-in catalogue.
 * @param {string} intent - The natural-language intent.
 * @param {Partial<PlanRequest>} overrides - Request fields to override.
 * @returns {PlanRequest} A complete plan request.
 */
function makeRequest(intent: string, overrides: Partial<PlanRequest> = {}): PlanRequest {
  return {
    input: FACTS.file,
    intent,
    facts: FACTS,
    profiles: BUILTIN_PROFILES,
    capabilities: CAPS,
    ...overrides,
  };
}

describe('codecFamily', () => {
  it('normalises encoder names to codec families', () => {
    expect(codecFamily('libx264')).toBe('h264');
    expect(codecFamily('libx265')).toBe('hevc');
    expect(codecFamily('hevc_nvenc')).toBe('hevc');
    expect(codecFamily('libsvtav1')).toBe('av1');
    expect(codecFamily('libvpx-vp9')).toBe('vp9');
  });
});

describe('parseIntent', () => {
  it('extracts device, resolution and size signals', () => {
    const signals = parseIntent('make this smaller for my iPhone at 720p');
    expect(signals.categories).toContain('devices');
    expect(signals.profileHints).toContain('iphone');
    expect(signals.wantsSmall).toBe(true);
    expect(signals.targetClass).toBe(720);
  });

  it('folds constraints into the signals', () => {
    const signals = parseIntent('convert this', { targetDevice: 'android', maxHeight: 720 });
    expect(signals.profileHints).toContain('android');
    expect(signals.targetClass).toBe(720);
  });
});

describe('selectProfile', () => {
  it('never upscales beyond the source resolution', () => {
    const signals = parseIntent('4k youtube');
    const profile = selectProfile(BUILTIN_PROFILES, FACTS, signals);
    expect(profile?.scale).toBe('1920x1080');
  });
});

describe('recommendSettings', () => {
  it('maps an iPhone request to the iPhone 1080p profile', () => {
    const plan = recommendSettings(makeRequest('make this work on my iPhone'));
    expect(plan.profileId).toBe('iphone-1080p');
    expect(plan.args).toMatchObject({ input: FACTS.file, videoCodec: 'libx264', audioCodec: 'aac', scale: '1920x1080' });
    expect(plan.providerId).toBe('rules');
    expect(plan.isEstimated).toBe(true);
    expect(plan.confidence).toBeGreaterThan(0.5);
  });

  it('honours an explicit target device via constraints', () => {
    const plan = recommendSettings(makeRequest('convert this', { constraints: { targetDevice: 'android' } }));
    expect(plan.profileId?.startsWith('android')).toBe(true);
  });

  it('selects a matching webm/vp9 profile', () => {
    const plan = recommendSettings(makeRequest('convert to webm vp9'));
    expect(plan.profileId).toBe('webm-vp9');
    expect(plan.args.container).toBeUndefined();
    expect(plan.args.videoCodec).toBe('libvpx-vp9');
  });

  it('picks the 720p YouTube profile when asked', () => {
    const plan = recommendSettings(makeRequest('make it smaller for youtube 720p'));
    expect(plan.profileId).toBe('yt-720p');
  });

  it('computes a target video bitrate from a byte ceiling and drops qscale', () => {
    const plan = recommendSettings(makeRequest('compress this', { constraints: { maxBytes: 1_000_000 } }));
    const profile = BUILTIN_PROFILES.find((candidate) => candidate.id === plan.profileId);
    const audioKbps = Number(String(profile?.audioBitrate ?? '128k').replace('k', ''));
    const expectedVideoKbps = Math.max(100, Math.floor((1_000_000 * 8) / 600 / 1000 - audioKbps));
    expect(plan.args.videoBitrate).toBe(`${expectedVideoKbps}k`);
    expect(plan.args.qscale).toBeUndefined();
    expect(plan.rationale.join(' ')).toContain('at or under');
  });

  it('caps the output scale to maxWidth', () => {
    const plan = recommendSettings(makeRequest('make this work on my iPhone', { constraints: { maxWidth: 1280 } }));
    expect(plan.args.scale).toBe('1280x720');
    expect(plan.rationale.join(' ')).toContain('size constraints');
  });

  it('selects an audio profile for audio-only intents', () => {
    const plan = recommendSettings(makeRequest('extract the audio as mp3'));
    const profile = BUILTIN_PROFILES.find((candidate) => candidate.id === plan.profileId);
    expect(profile?.category).toBe('audio');
  });

  it('is deterministic', () => {
    const a = recommendSettings(makeRequest('make this work on my iPhone'));
    const b = recommendSettings(makeRequest('make this work on my iPhone'));
    expect(a).toEqual(b);
  });

  it('degrades gracefully with no candidate profiles', () => {
    const plan = recommendSettings(makeRequest('do something', { profiles: [] }));
    expect(plan.confidence).toBe(0);
    expect(plan.args).toEqual({ input: FACTS.file });
  });
});
