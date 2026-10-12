/**
 * @fileoverview Deterministic Copilot operation router (main process).
 *
 * Chooses which EncodeX operation a goal maps to and turns it into ready-to-run
 * {@link CopilotAction}s. This is the offline, deterministic half of the Copilot
 * planner: it runs when no AI provider is configured, and it is also the
 * fallback whenever a configured provider fails or returns an unusable reply.
 *
 * It reuses the exact builders the MCP tools use (`src/mcp/operations.ts`), so a
 * Copilot job, an MCP call and a CLI command produce identical streams, naming
 * and options. It lives in `src/main` (not `src/shared/ai`) because those
 * builders reach into Node/main helpers and must never enter the renderer.
 */

import type { MediaInfo } from '../../shared/types';
import type { MediaFacts } from '../../shared/ai/types';
import type { CopilotAction, CopilotOperation, CopilotResult } from '../../shared/copilot';
import type { AgentSkip } from '../../shared/ai/agent';
import type { RoutedOperation } from '../../shared/ai/llm';
import { analyzeMedia } from '../../shared/ai/analyze';
import { formatError } from '../../shared/errors';
import {
  buildCompressPlan,
  buildExtractAudioPlan,
  buildCutPlan,
  buildRemuxPlan,
  buildDemuxPlan,
  buildDemuxJobOptions,
} from '../../mcp/operations';

/**
 * One probed candidate: its path, the reduced facts, and the raw probe (needed
 * by the stream-aware builders).
 * @interface ProbedEntry
 * @property {string} file - Absolute file path.
 * @property {MediaFacts} facts - Reduced facts.
 * @property {MediaInfo} info - Raw probe info.
 */
export interface ProbedEntry {
  file: string;
  facts: MediaFacts;
  info: MediaInfo;
}

/**
 * The actions, read-only results and skips built for one operation.
 * @interface BuiltOperation
 * @property {CopilotAction[]} actions - Queueable jobs.
 * @property {CopilotResult[]} results - Read-only findings.
 * @property {AgentSkip[]} skips - Files that could not be planned.
 */
export interface BuiltOperation {
  actions: CopilotAction[];
  results: CopilotResult[];
  skips: AgentSkip[];
}

/** Audio extension/name to the encoder the extract builder should use. */
const AUDIO_CODEC_BY_NAME: Record<string, string> = {
  mp3: 'libmp3lame',
  aac: 'aac',
  m4a: 'aac',
  flac: 'flac',
  wav: 'pcm_s16le',
  opus: 'libopus',
  ogg: 'libvorbis',
  vorbis: 'libvorbis',
};

/** Image extension/name to a normalized output format. */
const IMAGE_FORMAT_BY_NAME: Record<string, string> = {
  jpg: 'jpg',
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
  bmp: 'bmp',
  gif: 'gif',
  tiff: 'tiff',
  tif: 'tiff',
};

/** Containers the remux router recognises in a goal. */
const CONTAINERS = ['mp4', 'm4v', 'mkv', 'mov', 'webm', 'avi', 'ts'];

/**
 * Chooses the operation named by a goal, using ordered keyword rules. The first
 * match wins; `convert` is the default.
 * @param {string} goal - The natural-language goal.
 * @returns {CopilotOperation} The detected operation.
 */
export function detectOperation(goal: string): CopilotOperation {
  const text = ` ${String(goal ?? '').toLowerCase()} `;
  if (/\b(remux|repackage|repack|container change|change (the )?container|no re-?encode|without re-?encoding|stream copy)\b/.test(text))
    return 'remux';
  if (/\b(demux|extract (all )?streams?|separate streams?|split (in)?to streams?)\b/.test(text)) return 'demux';
  if (/\b(extract|rip|strip|pull).{0,24}(audio|sound|music|track)\b/.test(text) || /\b(audio only|mp3 only)\b/.test(text))
    return 'extract_audio';
  if (
    /\b(compress|reduce|shrink|resize|convert).{0,24}(image|photo|picture|png|jpe?g|webp|tiff|bmp)\b/.test(text) ||
    /\b(image|photo)\b.*\b(compress|smaller|reduce)\b/.test(text)
  )
    return 'compress_image';
  if (/\b(cut|trim|clip|slice|crop in time)\b/.test(text) || /\bfrom\b.+\bto\b/.test(text)) return 'cut';
  // Media-intelligence rules run before the generic `analyze` rule so a goal
  // that names a specific intelligence task (summarize/transcribe/...) wins.
  if (
    /\b(transcribe|transcription|captions?|speech[- ]to[- ]text)\b/.test(text) ||
    /\bsubtitles?\b.{0,24}\b(speech|audio|speech-to-text)\b/.test(text)
  )
    return 'transcribe';
  if (/\b(summar(?:y|ize|ise)|tl;?dr|recap|key ?points?|takeaways?)\b/.test(text)) return 'summarize';
  if (/\b(chapters?|chapter markers?|table of contents)\b/.test(text)) return 'chapters';
  if (/\b(find|search|locate)\b.{0,32}\b(says?|said|mentions?|talks? about|passage|quote|scene)\b/.test(text)) return 'search_transcript';
  if (/\btranslate\b/.test(text)) return 'translate';
  if (/\b(duplicates?|dupes?|near[- ]?duplicates?|dedupe|redundant|similar)\b/.test(text)) return 'find_similar';
  if (/\b(analy[sz]e|inspect|examine|report|details|info|diagnose)\b/.test(text)) return 'analyze';
  return 'convert';
}

/**
 * Detects the target container named in a goal (e.g. "remux to mkv").
 * @param {string} goal - The goal text.
 * @param {string} fallbackExt - Input extension used when none is named.
 * @returns {string} The target container extension (no dot).
 */
function detectContainer(goal: string, fallbackExt: string): string {
  const lower = String(goal ?? '').toLowerCase();
  const afterTo = /\bto\s+\.?(mp4|m4v|mkv|mov|webm|avi|ts)\b/.exec(lower);
  if (afterTo) return afterTo[1];
  for (const container of CONTAINERS) {
    if (new RegExp(`\\b${container}\\b`).test(lower)) return container;
  }
  return fallbackExt;
}

/** Common language names to BCP-47/ISO-639-1 codes for translate/transcribe. */
const LANGUAGE_BY_NAME: Record<string, string> = {
  english: 'en',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  italian: 'it',
  portuguese: 'pt',
  dutch: 'nl',
  russian: 'ru',
  japanese: 'ja',
  korean: 'ko',
  chinese: 'zh',
  mandarin: 'zh',
  arabic: 'ar',
  hindi: 'hi',
  turkish: 'tr',
  polish: 'pl',
  swedish: 'sv',
  ukrainian: 'uk',
};

/**
 * Pulls a language code named after `to`/`into`/`in` in the goal.
 * @param {string} lower - Lower-cased goal text.
 * @returns {string | undefined} The language code, if named.
 */
function detectLanguage(lower: string): string | undefined {
  const named = /\b(?:to|into|in)\s+([a-z]{2}|[a-z][a-z-]+)\b/.exec(lower);
  if (!named) return undefined;
  const token = named[1];
  if (LANGUAGE_BY_NAME[token]) return LANGUAGE_BY_NAME[token];
  if (token.length === 2) return token;
  return undefined;
}

/**
 * Extracts operation-specific fields from a goal. Unknown fields are simply
 * absent; the builders apply their own defaults.
 * @param {CopilotOperation} operation - The operation to extract fields for.
 * @param {string} goal - The goal text.
 * @param {string} [inputExt] - The input's extension, for container defaults.
 * @returns {Record<string, unknown>} The extracted fields.
 */
export function extractFields(operation: CopilotOperation, goal: string, inputExt = 'mp4'): Record<string, unknown> {
  const lower = String(goal ?? '').toLowerCase();
  switch (operation) {
    case 'remux':
      return { container: detectContainer(goal, inputExt) };
    case 'demux': {
      const fields: Record<string, unknown> = {};
      if (/\bvideo\b/.test(lower) && !/\baudio\b/.test(lower)) fields.video = true;
      else if (/\baudio\b/.test(lower) && !/\bvideo\b/.test(lower)) fields.audio = true;
      else if (/\bsubtitle/.test(lower)) fields.subtitles = true;
      else fields.all = true;
      return fields;
    }
    case 'extract_audio': {
      const fields: Record<string, unknown> = {};
      for (const [name, codec] of Object.entries(AUDIO_CODEC_BY_NAME)) {
        if (new RegExp(`\\b${name}\\b`).test(lower)) {
          fields.audioCodec = codec;
          break;
        }
      }
      const bitrate = /\b(\d{2,3})\s?k(?:bps)?\b/.exec(lower);
      if (bitrate) fields.bitrate = `${bitrate[1]}k`;
      return fields;
    }
    case 'compress_image': {
      const fields: Record<string, unknown> = {};
      for (const [name, format] of Object.entries(IMAGE_FORMAT_BY_NAME)) {
        if (new RegExp(`\\b${name}\\b`).test(lower)) {
          fields.format = format;
          break;
        }
      }
      const quality = /\b(?:quality|q)\s*(?:=\s*)?(\d{1,2})\b/.exec(lower);
      if (quality) fields.quality = Number(quality[1]);
      return fields;
    }
    case 'cut': {
      const times = [...lower.matchAll(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g)].map((match) => match[1]);
      const fields: Record<string, unknown> = {};
      if (times[0]) fields.startTime = times[0];
      if (times[1]) fields.endTime = times[1];
      return fields;
    }
    case 'transcribe': {
      const fields: Record<string, unknown> = {};
      const language = detectLanguage(lower);
      if (language) fields.language = language;
      const format = /\b(srt|vtt|webvtt|ass)\b/.exec(lower);
      if (format) fields.format = format[1] === 'webvtt' ? 'vtt' : format[1];
      return fields;
    }
    case 'summarize': {
      const fields: Record<string, unknown> = {};
      if (/\b(short|brief|concise|quick)\b/.test(lower)) fields.maxSentences = 3;
      const topics = /\b(\d{1,2})\s+topics?\b/.exec(lower);
      if (topics) fields.maxTopics = Number(topics[1]);
      return fields;
    }
    case 'chapters': {
      const fields: Record<string, unknown> = {};
      const count = /\b(\d{1,2})\s+chapters?\b/.exec(lower);
      if (count) fields.maxChapters = Number(count[1]);
      return fields;
    }
    case 'search_transcript': {
      const fields: Record<string, unknown> = {};
      const quoted = /["'\u201c\u2018]([^"'\u201d\u2019]{1,120})["'\u201d\u2019]/.exec(goal);
      if (quoted) fields.query = quoted[1].trim();
      return fields;
    }
    case 'translate': {
      const fields: Record<string, unknown> = {};
      const language = detectLanguage(lower);
      if (language) fields.targetLanguage = language;
      const format = /\b(srt|vtt|webvtt|ass)\b/.exec(lower);
      if (format) fields.format = format[1] === 'webvtt' ? 'vtt' : format[1];
      return fields;
    }
    default:
      return {};
  }
}

/**
 * Routes an operation deterministically from a forced choice or the goal text.
 * @param {{ goal: string; operation: CopilotOperation | null; inputExt?: string }} request -
 *   The goal, a forced operation (or null), and the input extension.
 * @returns {RoutedOperation} The routed operation.
 */
export function routeOperationDeterministic(request: {
  goal: string;
  operation: CopilotOperation | null;
  inputExt?: string;
}): RoutedOperation {
  const operation = request.operation ?? detectOperation(request.goal);
  return {
    operation,
    fields: extractFields(operation, request.goal, request.inputExt ?? 'mp4'),
    rationale: [request.operation ? `Operation "${operation}" was selected explicitly.` : `Routed to "${operation}" from the goal text.`],
    confidence: 0.5,
    providerId: 'rules',
  };
}

/**
 * Builds the actions or results for a non-convert operation over every entry.
 *
 * Each entry's own failures are isolated into a skip, mirroring the agent:
 * one unplannable file never fails the whole plan. `convert` is handled by the
 * agent planner in the Copilot IPC handler, not here.
 * @param {CopilotOperation} operation - The operation to build.
 * @param {Record<string, unknown>} fields - Fields extracted by the router.
 * @param {ProbedEntry[]} entries - The probed candidates.
 * @param {number} confidence - Planner confidence stamped on each action.
 * @param {string[]} rationale - Planner rationale stamped on each action.
 * @returns {BuiltOperation} The actions, results and skips.
 */
export function buildOperationActions(
  operation: CopilotOperation,
  fields: Record<string, unknown>,
  entries: ProbedEntry[],
  confidence: number,
  rationale: string[],
): BuiltOperation {
  const actions: CopilotAction[] = [];
  const results: CopilotResult[] = [];
  const skips: AgentSkip[] = [];

  for (const entry of entries) {
    const { file, facts, info } = entry;
    try {
      switch (operation) {
        case 'remux': {
          const plan = buildRemuxPlan(file, { container: fields.container as string | undefined }, info.streams);
          actions.push(makeAction('remux', actions.length, file, plan.output, plan.options, confidence, rationale));
          break;
        }
        case 'demux': {
          const plan = buildDemuxPlan(file, fields, info.streams);
          for (const target of plan.targets) {
            actions.push(makeAction('demux', actions.length, file, target.output, buildDemuxJobOptions(target), confidence, rationale));
          }
          break;
        }
        case 'extract_audio': {
          const plan = buildExtractAudioPlan(file, fields);
          actions.push(makeAction('extract_audio', actions.length, file, plan.output, plan.options, confidence, rationale));
          break;
        }
        case 'compress_image': {
          const plan = buildCompressPlan(file, fields);
          actions.push(makeAction('compress_image', actions.length, file, plan.output, plan.options, confidence, rationale));
          break;
        }
        case 'cut': {
          const plan = buildCutPlan(file, fields);
          actions.push(makeAction('cut', actions.length, file, plan.output, plan.options, confidence, rationale));
          break;
        }
        case 'analyze': {
          const analysis = analyzeMedia(info);
          results.push({ operation: 'analyze', input: file, title: analysis.summary, summary: analysis.summary, content: analysis });
          break;
        }
        default: {
          skips.push({ input: file, reason: `The "${operation}" operation is not available for this file.` });
          break;
        }
      }
    } catch (err) {
      skips.push({ input: file, reason: formatError(err).message });
    }
    void facts;
  }

  return { actions, results, skips };
}

/**
 * Assembles one {@link CopilotAction} with a stable, operation-prefixed id.
 * @param {CopilotOperation} operation - The action's operation.
 * @param {number} index - The action index (for the id).
 * @param {string} input - Source file path.
 * @param {string} output - Resolved output path.
 * @param {import('../../shared/types').ConversionOptions} options - Conversion options.
 * @param {number} confidence - Planner confidence.
 * @param {string[]} rationale - Planner rationale.
 * @returns {CopilotAction} The action.
 */
function makeAction(
  operation: CopilotOperation,
  index: number,
  input: string,
  output: string,
  options: import('../../shared/types').ConversionOptions,
  confidence: number,
  rationale: string[],
): CopilotAction {
  return {
    id: `${operation}_${index}`,
    operation,
    input,
    output,
    confidence,
    rationale,
    estimatedSavings: 0,
    options,
  };
}
