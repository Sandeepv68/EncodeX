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
 * Whether a provider id resolves to a working implementation in this build.
 * @param {AIProviderId} id - The provider id.
 * @returns {boolean} True when the provider can be constructed.
 */
export function isProviderImplemented(id: AIProviderId): boolean {
  return id === 'rules';
}

/**
 * Constructs the provider implementation for an id.
 *
 * Only `rules` is implemented in R1 (D3 defers the local adapter to R4 and the
 * remote adapters past the first AI release). Requesting any other id throws
 * {@link AIProviderUnavailableError} rather than silently falling back, so a
 * misconfiguration is visible instead of quietly changing privacy posture.
 * @param {AIProviderId} id - The provider id.
 * @returns {AIProvider} The constructed provider.
 * @throws {AIProviderUnavailableError} When the provider is not implemented.
 */
export function createProvider(id: AIProviderId): AIProvider {
  if (id === 'rules') return createRulesProvider();
  if (id === 'local') throw new AIProviderUnavailableError(id, 'the local adapter ships in R4 (decision D3).');
  throw new AIProviderUnavailableError(id, 'remote provider adapters are not part of the first AI release (R1).');
}
