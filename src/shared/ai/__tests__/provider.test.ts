/**
 * @fileoverview Unit tests for provider descriptors and the factory.
 */

import { describe, it, expect } from 'vitest';
import { BUILTIN_PROFILES } from '../../profiles/builtin';
import type { EncoderCapabilities } from '../../types';
import type { MediaFacts, PlanRequest } from '../types';
import {
  PROVIDER_DESCRIPTORS,
  createProvider,
  createRulesProvider,
  getProviderDescriptor,
  isProviderImplemented,
  listProviderDescriptors,
  AIProviderUnavailableError,
} from '../provider';

/** Minimal plan request. */
const REQUEST: PlanRequest = {
  input: 'C:/media/clip.mp4',
  intent: 'make this work on my iPhone',
  facts: {
    file: 'C:/media/clip.mp4',
    format: 'mov,mp4',
    sizeBytes: 1024,
    durationSeconds: 30,
    hasVideo: true,
    hasAudio: true,
    subtitleCount: 0,
    video: { codec: 'h264', width: 1920, height: 1080, hdr: false, interlaced: false },
  } satisfies MediaFacts,
  profiles: BUILTIN_PROFILES,
  capabilities: { videoEncoders: ['libx264'], audioEncoders: ['aac'], hwaccels: [] } satisfies EncoderCapabilities,
};

describe('provider descriptors', () => {
  it('declares the privacy posture per provider', () => {
    expect(PROVIDER_DESCRIPTORS.rules.dataEgress).toBe('none');
    expect(PROVIDER_DESCRIPTORS.local.dataEgress).toBe('none');
    expect(PROVIDER_DESCRIPTORS.openai.dataEgress).toBe('metadata');
    expect(PROVIDER_DESCRIPTORS.anthropic.dataEgress).toBe('metadata');
    expect(PROVIDER_DESCRIPTORS.gemini.dataEgress).toBe('metadata');
    expect(PROVIDER_DESCRIPTORS.rules.requiresApiKey).toBe(false);
    expect(PROVIDER_DESCRIPTORS.openai.requiresApiKey).toBe(true);
  });

  it('lists descriptors and looks them up by id', () => {
    expect(listProviderDescriptors()).toHaveLength(5);
    expect(getProviderDescriptor('rules')?.id).toBe('rules');
    expect(getProviderDescriptor('local')?.id).toBe('local');
  });
});

describe('createProvider', () => {
  it('builds a working rules provider', async () => {
    const provider = createProvider('rules');
    expect(provider.descriptor.id).toBe('rules');
    const plan = await provider.plan(REQUEST);
    expect(plan.providerId).toBe('rules');
    expect(plan.profileId).toBe('iphone-1080p');
  });

  it('reports which providers are implemented', () => {
    expect(isProviderImplemented('rules')).toBe(true);
    expect(isProviderImplemented('local')).toBe(false);
    expect(isProviderImplemented('openai')).toBe(false);
  });

  it('throws for unimplemented providers instead of silently falling back', () => {
    expect(() => createProvider('openai')).toThrow(AIProviderUnavailableError);
    expect(() => createProvider('local')).toThrow(AIProviderUnavailableError);
  });

  it('exposes a rules provider with the right descriptor', () => {
    expect(createRulesProvider().descriptor).toBe(PROVIDER_DESCRIPTORS.rules);
  });
});
