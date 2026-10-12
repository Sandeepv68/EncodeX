/**
 * @fileoverview Local subtitle-translation provider (roadmap 2.0, F12). Uses the
 * same {@link LocalModelClient} as the local planner to translate timed
 * subtitle lines on-device, then reattaches the translations to their original
 * timings. No network egress unless a cloud provider is wired later.
 */

import { createError, ErrorCode } from '../shared/errors';
import { normalizeTranslationSegments, parseTranslatedLines } from '../shared/ai/translate';
import type { TranslationProvider, TranslationRequest } from '../shared/ai/translate';
import type { LocalModelClient } from '../shared/ai/provider';
import type { TranscriptSegment } from '../shared/ai/transcript';

/**
 * Builds the translation prompt: the model must return a JSON array of strings
 * aligned one-to-one with the input lines.
 * @param {TranslationRequest} request - The translation request.
 * @returns {string} The prompt.
 */
export function buildTranslationPrompt(request: TranslationRequest): string {
  const lines = request.segments.map((segment) => segment.text);
  const source = request.sourceLanguage ? `The source language is ${request.sourceLanguage}. ` : '';
  return [
    `Translate the following subtitle lines to ${request.targetLanguage}. ${source}`,
    'Preserve the exact number of lines and their order. Translate only the text.',
    'Respond with a single JSON array of strings and nothing else. For example: ["Hello","World"].',
    '',
    JSON.stringify(lines),
  ].join('\n');
}

/**
 * Creates the on-device translation provider.
 * @param {LocalModelClient} [client] - The local model transport; when absent the
 *   provider reports itself unavailable.
 * @returns {TranslationProvider} The provider.
 */
export function createLocalTranslationProvider(client?: LocalModelClient): TranslationProvider {
  return {
    id: 'local',
    label: 'Local model',
    dataEgress: 'none',
    available: async (): Promise<boolean> => Boolean(client),
    translate: async (request: TranslationRequest): Promise<TranscriptSegment[]> => {
      if (!client) {
        throw createError(
          ErrorCode.TRANSLATION_UNAVAILABLE,
          'No local model runtime is configured. Set ENCODEX_LOCAL_MODEL_URL to enable on-device translation.',
        );
      }
      if (request.segments.length === 0) return [];
      const response = await client.generate(buildTranslationPrompt(request));
      const lines = parseTranslatedLines(response, request.segments.length);
      if (!lines) {
        throw createError(
          ErrorCode.TRANSLATION_UNAVAILABLE,
          'The local model did not return a usable translation (expected a JSON array of strings).',
        );
      }
      return normalizeTranslationSegments(request.segments, lines);
    },
  };
}
