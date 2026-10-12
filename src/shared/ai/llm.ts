/**
 * @fileoverview LLM-backed operation router (AI connector plan §3, §7).
 *
 * This is the *planner* half of the connector architecture: it builds a small,
 * closed prompt from the user's goal plus structured `MediaFacts`, asks an
 * injected {@link AIConnector} which single {@link CopilotOperation} to run and
 * with what fields, and parses the strict-JSON reply. The result is a *closed
 * shape* — one operation from a fixed vocabulary and a plain field bag — so the
 * deterministic router in the main process can still re-validate every field
 * with the same builders the MCP tools use. A malformed reply yields
 * `undefined`, letting the caller fall back to the deterministic rules.
 *
 * Electron-free and Node-free; the transport lives in `src/main/ai/connectors`.
 */

import type { ConversionProfile, EncoderCapabilities } from '../types';
import type { MediaFacts, AIProviderId } from './types';
import type { CopilotOperation } from '../copilot';
import type { AIConnector } from './connector';
import { extractJsonObject } from './provider';

/**
 * The closed operation vocabulary with a short description and the field names
 * each operation accepts. The prompt lists these; the parser rejects anything
 * outside the set. Kept as data so adding an operation is one entry.
 * @const {Record<CopilotOperation, { summary: string; fields: string[] }>}
 */
export const OPERATION_VOCABULARY: Record<CopilotOperation, { summary: string; fields: string[] }> = {
  convert: { summary: 'Transcode/re-encode media toward a goal (profiles, codecs, resolution).', fields: ['videoCodec', 'audioCodec', 'videoBitrate', 'audioBitrate', 'scale', 'pixelFormat', 'copy'] },
  remux: { summary: 'Losslessly repackage into another container (no re-encode).', fields: ['container'] },
  demux: { summary: 'Extract individual streams (video/audio/subtitles) to separate files.', fields: ['video', 'audio', 'subtitles', 'all'] },
  extract_audio: { summary: 'Extract the audio track to a standalone audio file.', fields: ['audioCodec', 'bitrate'] },
  compress_image: { summary: 'Compress or convert a still image.', fields: ['format', 'quality', 'scale'] },
  cut: { summary: 'Trim/cut a clip to a time range (lossless by default).', fields: ['startTime', 'endTime', 'duration', 'copy'] },
  analyze: { summary: 'Inspect a file and report facts/findings (read-only).', fields: [] },
  transcribe: { summary: 'Transcribe speech to timed subtitles with a local STT engine (read-only).', fields: ['language', 'format'] },
  summarize: { summary: 'Summarize the spoken content and list topics (read-only).', fields: ['maxSentences', 'maxTopics'] },
  chapters: { summary: 'Generate chapter markers and YouTube-style timestamps from speech (read-only).', fields: ['minChapterSeconds', 'maxChapterSeconds', 'maxChapters'] },
  search_transcript: { summary: 'Find a spoken passage and propose a clip around it (read-only).', fields: ['query', 'maxMatches', 'context'] },
  translate: { summary: 'Translate subtitles into another language, timing preserved (read-only).', fields: ['targetLanguage', 'sourceLanguage', 'format'] },
  find_similar: { summary: 'Detect duplicate and near-duplicate media across the inputs (read-only).', fields: ['method', 'threshold'] },
};

/** The ordered list of operation ids the router may return. */
export const OPERATION_IDS = Object.keys(OPERATION_VOCABULARY) as CopilotOperation[];

/**
 * A routed operation: the operation to run plus the fields the deterministic
 * builder should use.
 * @interface RoutedOperation
 * @property {CopilotOperation} operation - The chosen operation.
 * @property {Record<string, unknown>} fields - Operation-specific fields.
 * @property {string[]} rationale - Why the operation was chosen.
 * @property {number} confidence - Confidence in `[0, 1]`.
 * @property {AIProviderId} providerId - The provider that routed it.
 */
export interface RoutedOperation {
  operation: CopilotOperation;
  fields: Record<string, unknown>;
  rationale: string[];
  confidence: number;
  providerId: AIProviderId;
}

/**
 * The inputs an operation router needs to choose an operation.
 * @interface OperationRoutingRequest
 * @property {string} goal - The user's natural-language goal.
 * @property {CopilotOperation | null} operation - A forced operation, or null.
 * @property {MediaFacts[]} files - Structured facts for the candidate files.
 * @property {ConversionProfile[]} profiles - Built-in profiles to choose from.
 * @property {EncoderCapabilities} capabilities - Detected encoders.
 */
export interface OperationRoutingRequest {
  goal: string;
  operation: CopilotOperation | null;
  files: MediaFacts[];
  profiles: ConversionProfile[];
  capabilities: EncoderCapabilities;
}

/**
 * Whether a string is one of the known operations.
 * @param {unknown} value - The candidate value.
 * @returns {boolean} True when `value` is a {@link CopilotOperation}.
 */
export function isCopilotOperation(value: unknown): value is CopilotOperation {
  return typeof value === 'string' && (OPERATION_IDS as string[]).includes(value);
}

/**
 * Builds the operation-choice prompt handed to the AI connector. The model sees
 * only the goal, the closed operation vocabulary, and basename-level facts (no
 * absolute paths, no app internals), and must answer with one JSON object.
 * @param {OperationRoutingRequest} request - The routing request.
 * @returns {string} The prompt text.
 */
export function buildOperationPrompt(request: OperationRoutingRequest): string {
  const operations = OPERATION_IDS.map((id) => {
    const { summary, fields } = OPERATION_VOCABULARY[id];
    return `- ${id}: ${summary}${fields.length ? ` Fields: ${fields.join(', ')}.` : ''}`;
  }).join('\n');
  const fileList = request.files
    .slice(0, 20)
    .map((facts) => {
      const kind = facts.hasVideo ? 'video' : facts.hasAudio ? 'audio' : 'image';
      const dims = facts.video ? ` ${facts.video.width}x${facts.video.height}` : '';
      return `- ${basename(facts.file)} (${facts.format}, ${kind}${dims})`;
    })
    .join('\n');
  return [
    'You are EncodeX, a media-conversion assistant. Choose exactly ONE operation and its fields.',
    'Respond with a single JSON object and nothing else, using this shape:',
    '{"operation": string, "fields": object, "rationale": string[], "confidence": number}',
    'Do not include markdown fences. Do not invent operations or fields.',
    '',
    'Operations:',
    operations,
    '',
    `Goal: ${request.goal}`,
    `Files:\n${fileList || '- (none)'}`,
    `Profiles: ${request.profiles.map((profile) => profile.id).join(', ') || 'none'}.`,
    `Video encoders: ${request.capabilities.videoEncoders.join(', ') || 'none'}.`,
  ].join('\n');
}

/**
 * Extracts the final path segment from a path without importing `path` (this
 * module must stay Node-free). Handles both `/` and `\\` separators.
 * @param {string} file - The file path.
 * @returns {string} The basename.
 */
function basename(file: string): string {
  const parts = String(file ?? '').split(/[\\/]/);
  return parts[parts.length - 1] || String(file ?? '');
}

/**
 * Parses an AI connector's reply into a routed operation, or `undefined` when
 * the reply is not a usable operation choice. Every field is passed through
 * verbatim; the main-process operation router validates them per operation.
 * @param {string} text - The model's raw text reply.
 * @param {AIProviderId} providerId - The provider that produced the reply.
 * @returns {RoutedOperation | undefined} The routed operation, if usable.
 */
export function parseOperationPlan(text: string, providerId: AIProviderId): RoutedOperation | undefined {
  const json = extractJsonObject(text);
  if (!json) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
  const record = parsed as Record<string, unknown>;
  if (!isCopilotOperation(record.operation)) return undefined;
  const fields = record.fields && typeof record.fields === 'object' && !Array.isArray(record.fields) ? (record.fields as Record<string, unknown>) : {};
  const rationale = Array.isArray(record.rationale)
    ? record.rationale.filter((line): line is string => typeof line === 'string')
    : ['Operation chosen by the AI provider.'];
  const rawConfidence = typeof record.confidence === 'number' ? record.confidence : 0.5;
  const confidence = Math.max(0, Math.min(1, rawConfidence));
  return { operation: record.operation, fields, rationale, confidence, providerId };
}

/**
 * Builds a router function from an injected connector. The returned function
 * asks the connector once and parses the reply; a transport failure or an
 * unusable reply resolves to `undefined` so the caller falls back to the
 * deterministic router (never a hard failure).
 * @param {AIConnector} connector - The transport to use.
 * @param {AIProviderId} providerId - The provider id to stamp on the result.
 * @param {number} [timeoutMs] - Per-call timeout (default 30s).
 * @returns {(request: OperationRoutingRequest) => Promise<RoutedOperation | undefined>} The router.
 */
export function createLLMOperationRouter(
  connector: AIConnector,
  providerId: AIProviderId,
  timeoutMs = 30_000,
): (request: OperationRoutingRequest) => Promise<RoutedOperation | undefined> {
  return async (request: OperationRoutingRequest): Promise<RoutedOperation | undefined> => {
    try {
      const response = await connector.complete({
        messages: [
          { role: 'system', content: 'You choose one media operation and its fields. Reply with strict JSON only.' },
          { role: 'user', content: buildOperationPrompt(request) },
        ],
        jsonMode: true,
        temperature: 0,
        signal: AbortSignal.timeout(timeoutMs),
      });
      return parseOperationPlan(response.text, providerId);
    } catch {
      return undefined;
    }
  };
}
