/**
 * @fileoverview Asset resolution for the AI-provider brand logos.
 *
 * Bundles the brand SVGs from `assets/ai_providers/` and exposes a resolver that
 * maps a provider id and the active theme mode to the logo URL the Settings
 * provider buttons should render. The `_light` assets are white and the `_dark`
 * assets are black, so the contrast-based mapping renders the dark logo on the
 * light theme and the light logo on the dark theme. Providers without a bundled
 * logo (rules, local) return `null` and fall back to the FontAwesome glyph
 * {@link aiProviderFallbackIcon} resolves for them.
 */

import type { PaletteMode } from '@mui/material';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faRobot, faServer, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import type { AIProviderId } from '../../shared/ai/types';
import anthropicDark from '../../../assets/ai_providers/anthropic_dark.svg';
import anthropicLight from '../../../assets/ai_providers/anthropic_light.svg';
import geminiLogo from '../../../assets/ai_providers/gemini.svg';
import openAiDark from '../../../assets/ai_providers/open_ai_dark.svg';
import openAiLight from '../../../assets/ai_providers/open_ai_light.svg';

/**
 * Resolves the brand logo URL for an AI provider, or `null` when the provider
 * has no bundled SVG (callers should then render a fallback icon).
 * @param {AIProviderId} id - The provider to resolve a logo for.
 * @param {PaletteMode} mode - The active theme mode.
 * @returns {string | null} The bundled logo URL, or `null`.
 */
export function aiProviderLogo(id: AIProviderId, mode: PaletteMode): string | null {
  if (id === 'gemini') return geminiLogo;
  if (id === 'anthropic') return mode === 'dark' ? anthropicLight : anthropicDark;
  if (id === 'openai') return mode === 'dark' ? openAiLight : openAiDark;
  return null;
}

/**
 * Resolves the stand-in glyph for a provider that has no bundled logo, so
 * every place that shows a provider mark (the Settings provider list, the
 * connection badge, the composer button and the plan rows) draws the same
 * symbol for the same provider: a server for the local runtime, sparkles for
 * the built-in rules engine, and a generic robot when the provider is unknown.
 * @param {AIProviderId | null} [id] - The provider to resolve a glyph for.
 * @returns {IconDefinition} The FontAwesome glyph.
 */
export function aiProviderFallbackIcon(id?: AIProviderId | null): IconDefinition {
  if (id === 'local') return faServer;
  if (id === 'rules') return faWandMagicSparkles;
  return faRobot;
}
