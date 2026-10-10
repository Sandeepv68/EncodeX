/**
 * @fileoverview Subtitle translation contract (roadmap 2.0, F12). Defines a
 * provider interface so translation can be backed by a local runtime (default,
 * `dataEgress: 'none'`) or a labeled cloud service, plus the pure timing-
 * preserving merge that reattaches translated text to original segment times.
 *
 * `shared/` stays Node-free: the concrete local/cloud adapters live in `src/mcp`.
 */

import type { DataEgress } from './types';
import { normalizeSegmentText } from './transcript';
import type { TranscriptSegment } from './transcript';

/**
 * A translation request over already-timed subtitle segments.
 * @interface TranslationRequest
 * @property {TranscriptSegment[]} segments - Source segments (timing preserved).
 * @property {string} targetLanguage - Target language code.
 * @property {string} [sourceLanguage] - Optional source language hint.
 */
export interface TranslationRequest {
  segments: TranscriptSegment[];
  targetLanguage: string;
  sourceLanguage?: string;
}

/**
 * A subtitle translation backend.
 * @interface TranslationProvider
 * @property {string} id - Stable id.
 * @property {string} label - Human-readable name.
 * @property {DataEgress} dataEgress - What leaves the device.
 * @property {() => Promise<boolean>} available - Whether it can run here.
 * @property {(request: TranslationRequest) => Promise<TranscriptSegment[]>} translate - Translate.
 */
export interface TranslationProvider {
  id: string;
  label: string;
  dataEgress: DataEgress;
  available(): Promise<boolean>;
  translate(request: TranslationRequest): Promise<TranscriptSegment[]>;
}

/**
 * Public description of a translation backend, surfaced in the UI so egress is
 * never a surprise.
 * @interface TranslationProviderDescriptor
 * @property {string} id - Stable id.
 * @property {string} label - Human-readable name.
 * @property {DataEgress} dataEgress - What leaves the device.
 * @property {boolean} local - Whether translation runs on-device.
 * @property {string} note - Privacy/status note.
 */
export interface TranslationProviderDescriptor {
  id: string;
  label: string;
  dataEgress: DataEgress;
  local: boolean;
  note: string;
}

/**
 * Known translation providers, in display order. Only `local` ships in R4; the
 * cloud entries are declared so the egress posture is visible and can be wired
 * later.
 * @const {TranslationProviderDescriptor[]}
 */
export const TRANSLATION_PROVIDERS: TranslationProviderDescriptor[] = [
  {
    id: 'local',
    label: 'Local model',
    dataEgress: 'none',
    local: true,
    note: 'Translates on this device via the configured local runtime. Nothing leaves the machine.',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    dataEgress: 'metadata',
    local: false,
    note: 'Sends the subtitle text to OpenAI. Not wired in this release.',
  },
];

/**
 * Looks up a translation provider descriptor by id.
 * @param {string} id - The provider id.
 * @returns {TranslationProviderDescriptor | undefined} The descriptor, if known.
 */
export function getTranslationProvider(id: string): TranslationProviderDescriptor | undefined {
  return TRANSLATION_PROVIDERS.find((provider) => provider.id === id);
}

/**
 * Reattaches translated strings to their original segment timings.
 *
 * Missing translations fall back to the source text so no subtitle is dropped;
 * extra translated strings beyond the segment count are ignored. Timing always
 * comes from the source, never the model.
 * @param {TranscriptSegment[]} source - Original timed segments.
 * @param {string[]} translated - Translated strings, positionally aligned.
 * @returns {TranscriptSegment[]} Timed, translated segments.
 */
export function normalizeTranslationSegments(source: TranscriptSegment[], translated: string[]): TranscriptSegment[] {
  return source.map((segment, index) => {
    const text = normalizeSegmentText(translated[index] ?? '');
    return {
      start: segment.start,
      end: segment.end,
      text: text || normalizeSegmentText(segment.text),
      ...(segment.speaker ? { speaker: segment.speaker } : {}),
    };
  });
}

/**
 * Extracts the first balanced `[...]` JSON array from free text, ignoring
 * brackets inside string literals. Returns `undefined` when none is found.
 * @param {string} text - The model output.
 * @returns {string | undefined} The JSON array substring, if any.
 */
export function extractJsonArray(text: string): string | undefined {
  const source = String(text ?? '');
  const start = source.indexOf('[');
  if (start < 0) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return undefined;
}

/**
 * Parses a model reply that should be a JSON array of translated strings.
 * Non-string entries are coerced; the result is padded with empty strings to
 * `expected` length so callers can align it positionally.
 * @param {string} response - The model's raw text.
 * @param {number} expected - Number of source segments.
 * @returns {string[] | undefined} The aligned strings, or `undefined` when the reply held no array.
 */
export function parseTranslatedLines(response: string, expected: number): string[] | undefined {
  const json = extractJsonArray(response);
  if (!json) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) return undefined;
  const lines = parsed.map((entry) => (typeof entry === 'string' ? entry : String(entry ?? '')));
  while (lines.length < expected) lines.push('');
  return lines.slice(0, expected);
}
