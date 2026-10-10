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
  buildLocalPlanPrompt,
  extractJsonObject,
  parseLocalPlan,
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
    expect(isProviderImplemented('local')).toBe(true);
    expect(isProviderImplemented('openai')).toBe(false);
  });

  it('throws for unimplemented providers instead of silently falling back', () => {
    expect(() => createProvider('openai')).toThrow(AIProviderUnavailableError);
    expect(() => createProvider('anthropic')).toThrow(AIProviderUnavailableError);
  });

  it('builds the local provider (D3) that fails loudly without a runtime', async () => {
    const provider = createProvider('local');
    expect(provider.descriptor).toBe(PROVIDER_DESCRIPTORS.local);
    await expect(provider.plan(REQUEST)).rejects.toThrow(AIProviderUnavailableError);
  });

  it('plans via an injected local model client', async () => {
    const provider = createProvider('local', {
      localClient: {
        generate: async () => JSON.stringify({ args: { videoCodec: 'libx264', crf: 23 }, rationale: ['small'], confidence: 0.8 }),
      },
    });
    const plan = await provider.plan(REQUEST);
    expect(plan.providerId).toBe('local');
    expect(plan.args).toEqual({ videoCodec: 'libx264', crf: 23 });
    expect(plan.confidence).toBe(0.8);
  });

  it('exposes a rules provider with the right descriptor', () => {
    expect(createRulesProvider().descriptor).toBe(PROVIDER_DESCRIPTORS.rules);
  });
});

describe('local plan helpers', () => {
  it('extracts a balanced JSON object, ignoring braces in strings', () => {
    expect(extractJsonObject('prefix {"a":"}"} suffix')).toBe('{"a":"}"}');
    expect(extractJsonObject('no object here')).toBeUndefined();
  });

  it('builds a grounded prompt naming the intent and profiles', () => {
    const prompt = buildLocalPlanPrompt(REQUEST);
    expect(prompt).toContain('make this work on my iPhone');
    expect(prompt).toContain('iphone-1080p');
  });

  it('parses a model plan and clamps confidence', () => {
    const plan = parseLocalPlan('```json\n{"args":{"crf":20},"profileId":"iphone-1080p","rationale":["x"],"confidence":5}\n```', REQUEST);
    expect(plan.providerId).toBe('local');
    expect(plan.args).toEqual({ crf: 20 });
    expect(plan.confidence).toBe(1);
    expect(plan.profileId).toBe('iphone-1080p');
  });

  it('falls back to the deterministic rules plan on unusable output', () => {
    const plan = parseLocalPlan('sorry, I cannot help with that', REQUEST);
    expect(plan.providerId).toBe('local');
    expect(plan.profileId).toBe('iphone-1080p');
    expect(plan.rationale.some((line) => line.includes('deterministic rules plan'))).toBe(true);
  });
});
