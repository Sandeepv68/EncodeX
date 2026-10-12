/**
 * @fileoverview Tests for the local subtitle-translation provider
 * ({@link createLocalTranslationProvider}) and its prompt builder.
 *
 * The provider's only I/O is `client.generate`, so every test injects a fake
 * {@link LocalModelClient}; nothing leaves the process.
 */

import { describe, it, expect, vi } from 'vitest';
import { buildTranslationPrompt, createLocalTranslationProvider } from '../translate-engine';
import type { LocalModelClient } from '../../shared/ai/provider';
import type { TranslationRequest } from '../../shared/ai/translate';
import type { TranscriptSegment } from '../../shared/ai/transcript';

/** Segments with distinct text and overlapping timings. */
const SEGMENTS: TranscriptSegment[] = [
  { start: 0, end: 1.5, text: 'Hello' },
  { start: 1.5, end: 3, text: 'World' },
];

/** A TranslationRequest over {@link SEGMENTS}. */
function request(overrides: Partial<TranslationRequest> = {}): TranslationRequest {
  return { segments: SEGMENTS, targetLanguage: 'es', ...overrides };
}

/** A fake client whose generate() answers the given response. */
function clientReturning(response: string): LocalModelClient {
  return { generate: vi.fn().mockResolvedValue(response) };
}

describe('buildTranslationPrompt', () => {
  it('lists the plain lines and the target language', () => {
    const prompt = buildTranslationPrompt(request({ sourceLanguage: 'en' }));
    expect(prompt).toContain('Translate the following subtitle lines to es. The source language is en.');
    expect(prompt).toContain('["Hello","World"]');
  });

  it('omits the source-language hint when the request has none', () => {
    const prompt = buildTranslationPrompt(request());
    expect(prompt).not.toContain('source language');
  });
});

describe('createLocalTranslationProvider', () => {
  it('exposes a stable identity and no data egress', () => {
    const provider = createLocalTranslationProvider(clientReturning('[]'));
    expect(provider.id).toBe('local');
    expect(provider.label).toBe('Local model');
    expect(provider.dataEgress).toBe('none');
  });

  it('reports availability from the presence of a client', async () => {
    expect(await createLocalTranslationProvider(clientReturning('[]')).available()).toBe(true);
    expect(await createLocalTranslationProvider().available()).toBe(false);
  });

  it('throws TRANSLATION_UNAVAILABLE when no client is configured', async () => {
    const provider = createLocalTranslationProvider();
    try {
      await provider.translate(request());
      expect.unreachable('expected TRANSLATION_UNAVAILABLE');
    } catch (err) {
      expect((err as { code?: string }).code).toBe('TRANSLATION_UNAVAILABLE');
    }
  });

  it('returns no segments when the request has none', async () => {
    const client = clientReturning('[]');
    const provider = createLocalTranslationProvider(client);
    expect(await provider.translate(request({ segments: [] }))).toEqual([]);
    expect(client.generate).not.toHaveBeenCalled();
  });

  it('translates each segment and preserves the original timings', async () => {
    const client = clientReturning('["Hola","Mundo"]');
    const provider = createLocalTranslationProvider(client);
    const translated = await provider.translate(request());
    expect(client.generate).toHaveBeenCalledWith(expect.stringContaining('["Hello","World"]'));
    expect(translated).toEqual([
      { start: 0, end: 1.5, text: 'Hola' },
      { start: 1.5, end: 3, text: 'Mundo' },
    ]);
  });

  it('throws TRANSLATION_UNAVAILABLE when the model returns no usable array', async () => {
    const provider = createLocalTranslationProvider(clientReturning('The translation will follow shortly.'));
    try {
      await provider.translate(request());
      expect.unreachable('expected TRANSLATION_UNAVAILABLE');
    } catch (err) {
      expect((err as { code?: string }).code).toBe('TRANSLATION_UNAVAILABLE');
    }
  });
});
