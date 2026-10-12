/**
 * @fileoverview Media-intelligence builder for the Copilot (roadmap 7.4, R6).
 *
 * Wires the MCP-only media-intelligence tools (`transcribe`, `summarize`,
 * `chapters`, `search_transcript`, `translate`, `find_similar`) into the same
 * read-only result contract the `analyze` operation uses, so a goal typed in the
 * Copilot panel reaches every capability EncodeX ships.
 *
 * All heavy lifting is pure shared code (`shared/ai/*`) plus the MCP engine
 * adapters (`src/mcp/*`); this module only orchestrates them per file and
 * isolates each file's failures into a skip. Nothing here is enqueued — the
 * results are proposals the user reviews, exactly like `analyze`.
 */

import type { CopilotOperation, CopilotResult } from '../../shared/copilot';
import type { AgentSkip } from '../../shared/ai/agent';
import type { Transcript } from '../../shared/ai/transcript';
import type { SubtitleFormat } from '../../shared/ai/subtitles';
import type { FrameSampler, MediaSignature } from '../../shared/ai/similarity';
import type { TranslationProvider } from '../../shared/ai/translate';
import { summarizeTranscript } from '../../shared/ai/summarize';
import { generateChapters, chaptersToYouTube } from '../../shared/ai/chapters';
import { searchTranscript } from '../../shared/ai/transcript-search';
import { clusterSignatures } from '../../shared/ai/similarity';
import { formatSubtitles } from '../../shared/ai/subtitles';
import { createWhisperCliEngine } from '../../mcp/stt-engine';
import { createLocalTranslationProvider } from '../../mcp/translate-engine';
import { defaultFrameSampler } from '../../mcp/frame-sampler';
import { createError, ErrorCode, formatError } from '../../shared/errors';
import type { BuiltOperation, ProbedEntry } from './operation-router';

/**
 * The read-only media-intelligence operations handled here.
 * @const {readonly CopilotOperation[]} INTELLIGENCE_OPERATIONS
 */
export const INTELLIGENCE_OPERATIONS: readonly CopilotOperation[] = [
  'transcribe',
  'summarize',
  'chapters',
  'search_transcript',
  'translate',
  'find_similar',
];

/**
 * Whether an operation is a media-intelligence operation.
 * @param {CopilotOperation} operation - The operation.
 * @returns {boolean} True when {@link buildIntelligenceResults} handles it.
 */
export function isIntelligenceOperation(operation: CopilotOperation): boolean {
  return INTELLIGENCE_OPERATIONS.includes(operation);
}

/**
 * The swappable capabilities the intelligence builder needs. Tests inject fakes
 * so no FFmpeg/whisper binary is required.
 * @interface IntelligenceDeps
 * @property {(file: string, options?: { language?: string }) => Promise<Transcript>} transcribe - Transcribes an audio/video file.
 * @property {TranslationProvider} translate - The subtitle translation provider.
 * @property {FrameSampler} sampleFrame - Samples a perceptual hash for similarity.
 */
export interface IntelligenceDeps {
  transcribe(file: string, options?: { language?: string }): Promise<Transcript>;
  translate: TranslationProvider;
  sampleFrame: FrameSampler;
}

/**
 * Builds the real, FFmpeg/whisper-backed dependencies. Constructed lazily so
 * unrelated Copilot requests never spawn engine probes.
 * @returns {IntelligenceDeps} The production dependencies.
 */
export function defaultIntelligenceDeps(): IntelligenceDeps {
  const engine = createWhisperCliEngine();
  return {
    transcribe: (file, options) => engine.transcribe(file, options ?? {}),
    translate: createLocalTranslationProvider(),
    sampleFrame: defaultFrameSampler,
  };
}

/**
 * Reads a subtitle format from routed fields, defaulting to `srt`.
 * @param {Record<string, unknown>} fields - Routed fields.
 * @returns {SubtitleFormat} The requested format.
 */
function subtitleFormat(fields: Record<string, unknown>): SubtitleFormat {
  const value = fields.format;
  return value === 'vtt' || value === 'ass' || value === 'srt' ? value : 'srt';
}

/**
 * Reads a positive integer from routed fields.
 * @param {Record<string, unknown>} fields - Routed fields.
 * @param {string} key - The field name.
 * @returns {number | undefined} The number, when present and valid.
 */
function readNumber(fields: Record<string, unknown>, key: string): number | undefined {
  const value = fields[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Transcribes one entry, honouring the routed language hint.
 * @param {ProbedEntry} entry - The probed candidate.
 * @param {Record<string, unknown>} fields - Routed fields.
 * @param {IntelligenceDeps} deps - The injected capabilities.
 * @returns {Promise<Transcript>} The transcript.
 */
async function transcribeEntry(entry: ProbedEntry, fields: Record<string, unknown>, deps: IntelligenceDeps): Promise<Transcript> {
  const language = typeof fields.language === 'string' ? fields.language : undefined;
  return deps.transcribe(entry.file, language ? { language } : undefined);
}

/**
 * Builds signatures (metadata + a sampled perceptual hash) for dedupe.
 * @param {ProbedEntry[]} entries - The probed candidates.
 * @param {IntelligenceDeps} deps - The injected capabilities.
 * @returns {Promise<MediaSignature[]>} One signature per entry.
 */
async function buildSignatures(entries: ProbedEntry[], deps: IntelligenceDeps): Promise<MediaSignature[]> {
  const signatures: MediaSignature[] = [];
  for (const entry of entries) {
    const { file, facts } = entry;
    const signature: MediaSignature = {
      file,
      sizeBytes: facts.sizeBytes,
      durationSeconds: facts.durationSeconds,
    };
    if (facts.video?.width !== undefined) signature.width = facts.video.width;
    if (facts.video?.height !== undefined) signature.height = facts.video.height;
    if (facts.hasVideo && facts.durationSeconds > 0) {
      const hash = await deps.sampleFrame(file, facts.durationSeconds * 0.1);
      if (hash) signature.hash = hash;
    }
    signatures.push(signature);
  }
  return signatures;
}

/**
 * Builds the read-only results for a media-intelligence operation.
 *
 * Every entry is processed independently: a file that cannot be transcribed or
 * sampled becomes a skip, never a whole-plan failure. `find_similar` is
 * cross-file — it clusters all signatures into one set of dedupe results.
 * @param {CopilotOperation} operation - The intelligence operation.
 * @param {Record<string, unknown>} fields - Fields extracted by the router.
 * @param {ProbedEntry[]} entries - The probed candidates.
 * @param {IntelligenceDeps} [deps] - Injected capabilities (defaults to real engines).
 * @returns {Promise<BuiltOperation>} The results and skips (no actions).
 */
export async function buildIntelligenceResults(
  operation: CopilotOperation,
  fields: Record<string, unknown>,
  entries: ProbedEntry[],
  deps: IntelligenceDeps = defaultIntelligenceDeps(),
): Promise<BuiltOperation> {
  if (operation === 'find_similar') return buildSimilarityResults(fields, entries, deps);

  const results: CopilotResult[] = [];
  const skips: AgentSkip[] = [];
  for (const entry of entries) {
    const { file } = entry;
    try {
      const transcript = await transcribeEntry(entry, fields, deps);
      switch (operation) {
        case 'transcribe': {
          const format = subtitleFormat(fields);
          const subtitles = formatSubtitles(transcript.segments, format);
          results.push({
            operation,
            input: file,
            title: `Transcript (${transcript.segments.length} segments)`,
            summary: `${transcript.segments.length} timed segments, ${format.toUpperCase()} ready.`,
            content: { transcript, subtitles, format },
          });
          break;
        }
        case 'summarize': {
          const options = {
            ...(readNumber(fields, 'maxSentences') !== undefined ? { maxSentences: readNumber(fields, 'maxSentences') } : {}),
            ...(readNumber(fields, 'maxTopics') !== undefined ? { maxTopics: readNumber(fields, 'maxTopics') } : {}),
          };
          const summary = summarizeTranscript(transcript, options);
          results.push({
            operation,
            input: file,
            title: summary.topics.length > 0 ? summary.topics.slice(0, 3).join(' · ') : 'Summary',
            summary: summary.summary.join(' '),
            content: summary,
          });
          break;
        }
        case 'chapters': {
          const options = {
            ...(readNumber(fields, 'minChapterSeconds') !== undefined
              ? { minChapterSeconds: readNumber(fields, 'minChapterSeconds') }
              : {}),
            ...(readNumber(fields, 'maxChapterSeconds') !== undefined
              ? { maxChapterSeconds: readNumber(fields, 'maxChapterSeconds') }
              : {}),
            ...(readNumber(fields, 'maxChapters') !== undefined ? { maxChapters: readNumber(fields, 'maxChapters') } : {}),
          };
          const chapters = generateChapters(transcript, options);
          results.push({
            operation,
            input: file,
            title: `${chapters.length} chapters`,
            summary: chapters
              .map((chapter) => chapter.title)
              .slice(0, 3)
              .join(' · '),
            content: { chapters, youtube: chaptersToYouTube(chapters) },
          });
          break;
        }
        case 'search_transcript': {
          const query = typeof fields.query === 'string' ? fields.query.trim() : '';
          if (!query) throw createError(ErrorCode.INPUT_NOT_SPECIFIED, 'A search phrase is required.');
          const search = searchTranscript(transcript.segments, query, {
            ...(readNumber(fields, 'maxMatches') !== undefined ? { maxMatches: readNumber(fields, 'maxMatches') } : {}),
            ...(readNumber(fields, 'context') !== undefined ? { context: readNumber(fields, 'context') } : {}),
          });
          results.push({
            operation,
            input: file,
            title: search.matches.length > 0 ? `"${query}" found` : `"${query}" not found`,
            summary: search.matches.length > 0 ? `${search.matches.length} matching passage(s).` : `No passage matched "${query}".`,
            content: search,
          });
          break;
        }
        case 'translate': {
          const targetLanguage = typeof fields.targetLanguage === 'string' ? fields.targetLanguage.trim() : '';
          if (!targetLanguage) throw createError(ErrorCode.INPUT_NOT_SPECIFIED, 'A target language is required.');
          const translated = await deps.translate.translate({
            segments: transcript.segments,
            targetLanguage,
            ...(transcript.language ? { sourceLanguage: transcript.language } : {}),
          });
          const format = subtitleFormat(fields);
          results.push({
            operation,
            input: file,
            title: `${targetLanguage.toUpperCase()} subtitles`,
            summary: `Translated ${translated.length} segments to ${targetLanguage}.`,
            content: { segments: translated, format, subtitles: formatSubtitles(translated, format) },
          });
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
  }
  return { actions: [], results, skips };
}

/**
 * Clusters all entries into duplicate/near-duplicate groups.
 * @param {Record<string, unknown>} fields - Routed fields.
 * @param {ProbedEntry[]} entries - The probed candidates.
 * @param {IntelligenceDeps} deps - The injected capabilities.
 * @returns {Promise<BuiltOperation>} One result per cluster (or a "none found" result).
 */
async function buildSimilarityResults(
  fields: Record<string, unknown>,
  entries: ProbedEntry[],
  deps: IntelligenceDeps,
): Promise<BuiltOperation> {
  const results: CopilotResult[] = [];
  const skips: AgentSkip[] = [];
  let signatures: MediaSignature[];
  try {
    signatures = await buildSignatures(entries, deps);
  } catch (err) {
    return {
      actions: [],
      results: [],
      skips: [{ input: entries[0]?.file ?? '', reason: formatError(err).message }],
    };
  }
  const threshold = readNumber(fields, 'threshold') ?? 0.75;
  const report = clusterSignatures(signatures, { threshold });
  if (report.clusters.length === 0) {
    results.push({
      operation: 'find_similar',
      input: entries[0]?.file ?? '',
      title: 'No duplicate media found',
      summary: `Compared ${report.compared} file(s) via ${report.method}; no matches at ${threshold}.`,
      content: report,
    });
    return { actions: [], results, skips };
  }
  for (const cluster of report.clusters) {
    results.push({
      operation: 'find_similar',
      input: cluster.files[0],
      title: `${cluster.files.length} ${cluster.label === 'duplicate' ? 'duplicates' : 'near-duplicates'}`,
      summary: cluster.files.map((file) => file.split(/[\\/]/).pop() ?? file).join(', '),
      content: { cluster, method: report.method, threshold: report.threshold },
    });
  }
  return { actions: [], results, skips };
}
