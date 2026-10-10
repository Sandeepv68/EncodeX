/**
 * @fileoverview Speech-to-text engine contract (roadmap 2.0, F11) and the pure
 * parsers that turn engine output into a {@link Transcript}. The interface makes
 * STT swappable and testable; the parser is model-independent code so a fake
 * engine and a real whisper.cpp run produce the same transcript shape.
 *
 * No process spawning happens here — that lives in the MCP server's engine
 * adapter — so `shared/` stays free of Node built-ins and browser-safe.
 */

import { buildTranscript } from './transcript';
import type { Transcript, TranscriptSegment } from './transcript';

/**
 * Options passed through to an STT engine.
 * @interface SttOptions
 * @property {string} [language] - Force the source language (BCP-47 or ISO-639-1).
 * @property {string} [modelPath] - Path to a model file, when the engine needs one.
 * @property {number} [timeoutMs] - Wall-clock budget for the transcription.
 */
export interface SttOptions {
  language?: string;
  modelPath?: string;
  timeoutMs?: number;
}

/**
 * A speech-to-text engine.
 * @interface SttEngine
 * @property {string} id - Stable identifier (e.g. `whisper.cpp`).
 * @property {string} label - Human-readable name.
 * @property {() => Promise<boolean>} available - Whether the engine can run here.
 * @property {(audioPath: string, options?: SttOptions) => Promise<Transcript>} transcribe - Transcribe an audio file.
 */
export interface SttEngine {
  id: string;
  label: string;
  available(): Promise<boolean>;
  transcribe(audioPath: string, options?: SttOptions): Promise<Transcript>;
}

/**
 * Parses a `HH:MM:SS,mmm` (or `HH:MM:SS.mmm`) timestamp into seconds.
 * @param {string} value - The timestamp.
 * @returns {number} Seconds, or `NaN` when unparseable.
 */
export function parseClockTimestamp(value: string): number {
  const match = /^(\d+):(\d{2}):(\d{2})[.,](\d{1,3})$/.exec(String(value ?? '').trim());
  if (!match) return Number.NaN;
  const [, hours, minutes, seconds, millis] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(millis.padEnd(3, '0')) / 1000;
}

/**
 * Parses whisper.cpp `-oj` JSON. Accepts both the whisper.cpp `transcription`
 * array (with `offsets`/`timestamps`) and the OpenAI-style `segments` array;
 * the OpenAI shape is tried only when no `transcription` array is present.
 * @param {unknown} raw - Parsed JSON.
 * @param {string} [engine] - Engine id to stamp on the transcript.
 * @returns {Transcript} A normalized transcript.
 */
export function parseWhisperJson(raw: unknown, engine = 'whisper.cpp'): Transcript {
  const record = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const language =
    typeof (record.result as Record<string, unknown> | undefined)?.language === 'string'
      ? ((record.result as Record<string, unknown>).language as string)
      : typeof record.language === 'string'
        ? (record.language as string)
        : undefined;
  const segments: TranscriptSegment[] = [];
  const transcription = Array.isArray(record.transcription) ? record.transcription : undefined;
  const openaiSegments = Array.isArray(record.segments) ? record.segments : undefined;
  if (transcription) {
    for (const item of transcription) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;
      const offsets = entry.offsets as Record<string, unknown> | undefined;
      const timestamps = entry.timestamps as Record<string, unknown> | undefined;
      let start = Number.NaN;
      let end = Number.NaN;
      if (offsets && typeof offsets.from === 'number' && typeof offsets.to === 'number') {
        start = offsets.from / 1000;
        end = offsets.to / 1000;
      } else if (timestamps && typeof timestamps.from === 'string' && typeof timestamps.to === 'string') {
        start = parseClockTimestamp(timestamps.from);
        end = parseClockTimestamp(timestamps.to);
      }
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      segments.push({ start, end, text: String(entry.text ?? '') });
    }
  } else if (openaiSegments) {
    for (const item of openaiSegments) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;
      const start = Number(entry.start);
      const end = Number(entry.end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      segments.push({ start, end, text: String(entry.text ?? '') });
    }
  }
  const durationSeconds =
    typeof record.duration === 'number' ? record.duration : segments.length > 0 ? segments[segments.length - 1].end : 0;
  return buildTranscript(segments, { engine, language, durationSeconds });
}

/**
 * Builds a transcript from plain text with rough, evenly-spaced timings. Used
 * when an engine returns text without segment timing.
 * @param {string} text - The full transcript text.
 * @param {number} durationSeconds - Total media duration.
 * @param {string} engine - Engine id.
 * @returns {Transcript} A single-block synthetic transcript.
 */
export function transcriptFromText(text: string, durationSeconds: number, engine: string): Transcript {
  const clean = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const segments = clean ? [{ start: 0, end: Math.max(0, durationSeconds), text: clean }] : [];
  return buildTranscript(segments, { engine, durationSeconds });
}
