/**
 * @fileoverview AI provider descriptors and factory (roadmap §7.1, §7.5).
 *
 * The abstraction is intentionally thin: a provider is a descriptor plus a
 * `plan(request)` method. Nothing provider-specific may leak past this file.
 * In R1 only the deterministic `rules` provider is implemented; the remote
 * adapters are declared as descriptors (so Settings can show their privacy
 * posture) but resolve to an "unavailable" error until later releases.
 */

import type { AIProvider, AIProviderDescriptor, AIProviderId, PlanRequest, RecommendedSettings } from './types';
import { recommendSettings } from './recommend';

/**
 * Minimal text-generation transport a local model runtime must provide. Keeping
 * it to a single `generate(prompt)` call lets the provider stay transport-free
 * (the HTTP/Ollama adapter lives in `src/mcp`), so it is trivially fakeable in
 * tests.
 * @interface LocalModelClient
 * @property {(prompt: string) => Promise<string>} generate - Returns the model's raw text.
 */
export interface LocalModelClient {
  generate(prompt: string): Promise<string>;
}

/**
 * Raised when a provider is requested that this build cannot construct.
 * @augments Error
 */
export class AIProviderUnavailableError extends Error {
  /**
   * @param {AIProviderId} id - The unavailable provider id.
   * @param {string} reason - Why the provider is unavailable.
   */
  constructor(
    public readonly id: AIProviderId,
    reason: string,
  ) {
    super(`AI provider "${id}" is unavailable: ${reason}`);
    this.name = 'AIProviderUnavailableError';
  }
}

/**
 * Public descriptions of every known provider, keyed by id. Settings surfaces
 * these (including {@link AIProviderDescriptor.dataEgress}) verbatim.
 * @const {Record<AIProviderId, AIProviderDescriptor>}
 */
export const PROVIDER_DESCRIPTORS: Record<AIProviderId, AIProviderDescriptor> = {
  rules: {
    id: 'rules',
    label: 'Built-in rules (offline)',
    dataEgress: 'none',
    requiresApiKey: false,
    note: 'Deterministic profile matching. No model call, no network access.',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    dataEgress: 'metadata',
    requiresApiKey: true,
    note: 'Sends probe facts and your intent text to OpenAI. File bytes are never uploaded.',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    dataEgress: 'metadata',
    requiresApiKey: true,
    note: 'Sends probe facts and your intent text to Anthropic. File bytes are never uploaded.',
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    dataEgress: 'metadata',
    requiresApiKey: true,
    note: 'Sends probe facts and your intent text to Google. File bytes are never uploaded.',
  },
  local: {
    id: 'local',
    label: 'Local model',
    dataEgress: 'none',
    requiresApiKey: false,
    note: 'Runs on this device via a local runtime. Nothing leaves the machine.',
  },
};

/**
 * Lists every provider descriptor in a stable order.
 * @returns {AIProviderDescriptor[]} The descriptors.
 */
export function listProviderDescriptors(): AIProviderDescriptor[] {
  return [
    PROVIDER_DESCRIPTORS.rules,
    PROVIDER_DESCRIPTORS.local,
    PROVIDER_DESCRIPTORS.openai,
    PROVIDER_DESCRIPTORS.anthropic,
    PROVIDER_DESCRIPTORS.gemini,
  ];
}

/**
 * Looks up a provider descriptor by id.
 * @param {AIProviderId} id - The provider id.
 * @returns {AIProviderDescriptor | undefined} The descriptor, if known.
 */
export function getProviderDescriptor(id: AIProviderId): AIProviderDescriptor | undefined {
  return PROVIDER_DESCRIPTORS[id];
}

/**
 * The deterministic, offline provider backed by {@link recommendSettings}.
 * @returns {AIProvider} The rules provider.
 */
export function createRulesProvider(): AIProvider {
  return {
    descriptor: PROVIDER_DESCRIPTORS.rules,
    plan: async (request: PlanRequest): Promise<RecommendedSettings> => recommendSettings(request),
  };
}

/**
 * Extracts the first balanced `{...}` JSON object from free text, ignoring
 * braces inside string literals. Returns `undefined` when none is found.
 * @param {string} text - The model output.
 * @returns {string | undefined} The JSON substring, if any.
 */
export function extractJsonObject(text: string): string | undefined {
  const source = String(text ?? '');
  const start = source.indexOf('{');
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
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return undefined;
}

/**
 * Builds the planning prompt handed to a local model. The model is asked to
 * return strictly-JSON so the plan can be re-validated before it is trusted.
 * @param {PlanRequest} request - The grounded planning request.
 * @returns {string} The prompt text.
 */
export function buildLocalPlanPrompt(request: PlanRequest): string {
  const profileList = request.profiles.map((profile) => `${profile.id} (${profile.name})`).join(', ');
  return [
    'You are an expert video-encoding assistant. Choose encoding settings.',
    'Respond with a single JSON object and nothing else, using this shape:',
    '{"args": {"videoCodec": string, "audioCodec": string, "crf": number, "preset": string}, ' +
      '"profileId": string, "rationale": string[], "confidence": number}',
    'Do not include markdown fences. Do not invent FFmpeg flags.',
    '',
    `Goal: ${request.intent}`,
    `Input: ${request.input}`,
    `Source: ${request.facts.durationSeconds}s, ` +
      `${request.facts.video ? `${request.facts.video.width}x${request.facts.video.height} ${request.facts.video.codec}` : 'no video'}, ` +
      `${request.facts.audio ? `audio ${request.facts.audio.codec}` : 'no audio'}.`,
    `Available profiles: ${profileList || 'none'}.`,
    `Video encoders: ${request.capabilities.videoEncoders.join(', ') || 'none'}.`,
    request.constraints ? `Constraints: ${JSON.stringify(request.constraints)}.` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Parses a local model's reply into a validated plan. Falls back to the
 * deterministic rules plan (still fully local) when the reply is not usable, so
 * a malformed model output degrades gracefully instead of failing the request.
 * @param {string} response - The model's raw text.
 * @param {PlanRequest} request - The originating request.
 * @returns {RecommendedSettings} A plan with `providerId: 'local'`.
 */
export function parseLocalPlan(response: string, request: PlanRequest): RecommendedSettings {
  const json = extractJsonObject(response);
  if (json) {
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>;
      const args = parsed.args;
      if (args && typeof args === 'object' && !Array.isArray(args)) {
        const rationale = Array.isArray(parsed.rationale)
          ? parsed.rationale.filter((line): line is string => typeof line === 'string')
          : ['Local model plan.'];
        const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
        return {
          args: args as Record<string, unknown>,
          ...(typeof parsed.profileId === 'string' ? { profileId: parsed.profileId } : {}),
          rationale,
          confidence,
          providerId: 'local',
          isEstimated: true,
        };
      }
    } catch {
      /* fall through to the rules plan */
    }
  }
  const fallback = recommendSettings(request);
  return {
    ...fallback,
    providerId: 'local',
    rationale: [...fallback.rationale, 'Local model reply was not usable; used the deterministic rules plan.'],
  };
}

/**
 * The local-model provider (decision D3, shipped in R4). Delegates generation to
 * an injected {@link LocalModelClient}; when no runtime is configured the plan
 * call fails loudly rather than silently changing privacy posture.
 * @param {LocalModelClient} [client] - The local model transport.
 * @returns {AIProvider} The local provider.
 */
export function createLocalProvider(client?: LocalModelClient): AIProvider {
  return {
    descriptor: PROVIDER_DESCRIPTORS.local,
    plan: async (request: PlanRequest): Promise<RecommendedSettings> => {
      if (!client) {
        throw new AIProviderUnavailableError('local', 'no local model runtime is configured.');
      }
      const response = await client.generate(buildLocalPlanPrompt(request));
      return parseLocalPlan(response, request);
    },
  };
}

/**
 * Whether a provider id resolves to a working implementation in this build.
 * @param {AIProviderId} id - The provider id.
 * @returns {boolean} True when the provider can be constructed.
 */
export function isProviderImplemented(id: AIProviderId): boolean {
  return id === 'rules' || id === 'local';
}

/**
 * Constructs the provider implementation for an id.
 *
 * `rules` is always available. `local` was shipped in R4 (decision D3): it
 * needs a {@link LocalModelClient}, supplied by the host (the MCP server wires
 * the HTTP adapter). The remote adapters remain unimplemented. Requesting an
 * unimplemented id throws {@link AIProviderUnavailableError} rather than
 * silently falling back, so a misconfiguration is visible instead of quietly
 * changing privacy posture.
 * @param {AIProviderId} id - The provider id.
 * @param {{ localClient?: LocalModelClient }} [options] - Host-supplied adapters.
 * @returns {AIProvider} The constructed provider.
 * @throws {AIProviderUnavailableError} When the provider is not implemented.
 */
export function createProvider(id: AIProviderId, options: { localClient?: LocalModelClient } = {}): AIProvider {
  if (id === 'rules') return createRulesProvider();
  if (id === 'local') return createLocalProvider(options.localClient);
  throw new AIProviderUnavailableError(id, 'remote provider adapters are not part of the first AI release (R1).');
}
