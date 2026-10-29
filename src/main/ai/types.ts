/**
 * @fileoverview Type definitions for the main-process AI layer.
 * Describes the injectable fetch contract the provider connectors depend on,
 * the provider model-list entries, the neutral operation-router shapes, and the
 * swappable media-intelligence capabilities.
 */

import type { AgentSkip } from '../../shared/ai/agent';
import type { OperationRoutingRequest, RoutedOperation } from '../../shared/ai/llm';
import type { FrameSampler } from '../../shared/ai/similarity';
import type { Transcript } from '../../shared/ai/transcript';
import type { TranslationProvider } from '../../shared/ai/translate';
import type { MediaFacts } from '../../shared/ai/types';
import type { CopilotAction, CopilotResult } from '../../shared/copilot';
import type { MediaInfo } from '../../shared/types';

/**
 * The fetch signature connectors depend on (injectable for tests).
 * @typedef {function(string, Object=): Promise<Response>} FetchLike
 */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * One model a provider reported, with the creation date it published (when the
 * provider reports one). The date is what orders the pick-list: the newest
 * model a provider offers is the one least likely to be retired, so it is the
 * safest automatic choice.
 * @interface ProviderModelEntry
 * @property {string} id - The model id.
 * @property {number} [created] - Epoch ms the model was created, when reported.
 */
export interface ProviderModelEntry {
  id: string;
  created?: number;
}

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
 * The router seam the Copilot handler consumes: resolves a routed operation, or
 * `undefined` to fall back to the deterministic router.
 * @typedef {function(OperationRoutingRequest): Promise<RoutedOperation | undefined>} OperationRouter
 */
export type OperationRouter = (request: OperationRoutingRequest) => Promise<RoutedOperation | undefined>;
