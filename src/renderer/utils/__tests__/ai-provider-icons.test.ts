import { describe, it, expect } from 'vitest';
import { faRobot, faServer, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { aiProviderFallbackIcon, aiProviderLogo } from '../ai-provider-icons';
import anthropicDark from '../../../../assets/ai_providers/anthropic_dark.svg';
import anthropicLight from '../../../../assets/ai_providers/anthropic_light.svg';
import geminiLogo from '../../../../assets/ai_providers/gemini.svg';
import openAiDark from '../../../../assets/ai_providers/open_ai_dark.svg';
import openAiLight from '../../../../assets/ai_providers/open_ai_light.svg';

describe('aiProviderLogo', () => {
  it('returns the single Gemini logo for both themes', () => {
    expect(aiProviderLogo('gemini', 'light')).toBe(geminiLogo);
    expect(aiProviderLogo('gemini', 'dark')).toBe(geminiLogo);
  });

  it('selects the dark-on-light Anthropic logo and the light-on-dark one', () => {
    expect(aiProviderLogo('anthropic', 'light')).toBe(anthropicDark);
    expect(aiProviderLogo('anthropic', 'dark')).toBe(anthropicLight);
  });

  it('selects the dark-on-light OpenAI logo and the light-on-dark one', () => {
    expect(aiProviderLogo('openai', 'light')).toBe(openAiDark);
    expect(aiProviderLogo('openai', 'dark')).toBe(openAiLight);
  });

  it('returns null for providers without a bundled logo', () => {
    expect(aiProviderLogo('rules', 'light')).toBeNull();
    expect(aiProviderLogo('local', 'dark')).toBeNull();
  });
});

describe('aiProviderFallbackIcon', () => {
  it('uses a server glyph for the local runtime', () => {
    expect(aiProviderFallbackIcon('local')).toBe(faServer);
  });

  it('uses sparkles for the built-in rules engine', () => {
    expect(aiProviderFallbackIcon('rules')).toBe(faWandMagicSparkles);
  });

  it('falls back to a robot for an unknown or missing provider', () => {
    expect(aiProviderFallbackIcon(null)).toBe(faRobot);
    expect(aiProviderFallbackIcon(undefined)).toBe(faRobot);
  });
});
