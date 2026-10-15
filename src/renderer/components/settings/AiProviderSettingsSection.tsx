/**
 * @fileoverview AI-provider settings section for the Settings page
 * (AI connector plan §8).
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton, Tooltip, InputAdornment } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWandMagicSparkles,
  faArrowUpRightFromSquare,
  faChevronDown,
  faChevronUp,
  faPaste,
  faServer,
  faGear,
} from '@fortawesome/free-solid-svg-icons';
import { useColorMode } from '../../ColorModeContext';
import type { AiSettingsView } from '../../../shared/ai/settings';
import { AI_PROVIDER_CHOICES, AI_PROVIDERS_REQUIRING_KEY, isAiProviderId } from '../../../shared/ai/settings';
import type { AIProviderId } from '../../../shared/ai/types';
import { bridgePromise } from '../../utils/bridge-call';
import { aiProviderLogo } from '../../utils/ai-provider-icons';
import { formatError } from '../../../shared/errors';
import { SettingsLabel, McpField } from '../../styles/Settings.styles';
import {
  AiSettingsSection,
  AiHeaderRow,
  AiWell,
  ProviderGrid,
  ProviderButton,
  ProviderName,
  ProviderLogo,
  AiKeyHelper,
  AiKeyRow,
  AdvancedPanel,
  AiAlert,
} from '../../styles/settings/AiProviderSettingsSection.styles';

/**
 * The page where users create an API key for each remote AI provider. Opened in
 * the system browser so the user can copy a key and paste it back here.
 * @const {Partial<Record<AIProviderId, string>>} AI_PROVIDER_KEY_URLS
 */
const AI_PROVIDER_KEY_URLS: Partial<Record<AIProviderId, string>> = {
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  gemini: 'https://aistudio.google.com/app/apikey',
};

/**
 * Renders the brand icon for an AI provider: the bundled brand SVG for
 * OpenAI, Anthropic, and Gemini (theme-aware), and a FontAwesome stand-in for
 * the providers without a bundled logo (rules, local).
 * @param {{ id: AIProviderId }} props - The provider to render.
 * @returns {JSX.Element} The provider icon.
 */
function ProviderIcon({ id }: { id: AIProviderId }) {
  const { mode } = useColorMode();
  const logo = aiProviderLogo(id, mode);
  if (logo) {
    return <ProviderLogo src={logo} alt="" aria-hidden="true" data-testid={`settings-ai-logo-${id}`} />;
  }
  const icon = id === 'local' ? faServer : faWandMagicSparkles;
  return <FontAwesomeIcon icon={icon} />;
}

/**
 * Renders the AI-provider settings (AI connector plan §8): an inline well with
 * provider icon buttons, a one-tap connect flow (deep-link to the provider's key
 * page, paste, then save + test), and model/base-URL fields under "Advanced".
 *
 * Provider settings live in `userData/ai-settings.json` (not the settings
 * store), so this section is the one direct-IPC exception on the page. To keep
 * the page inert on mount (so every hostile/renderer suite can mount it
 * safely), the editor loads its settings only when the user expands it. Every
 * bridge call goes through {@link bridgePromise} and a shape check, so a
 * missing, throwing, or garbage bridge leaves the form at its offline defaults
 * instead of crashing the tree.
 * @returns {JSX.Element} The AI-provider settings rows.
 */
export default function AiProviderSettingsSection() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<AiSettingsView | null>(null);
  const [providerId, setProviderId] = useState<AIProviderId>('rules');
  const [model, setModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);

  /**
   * Expands/collapses the editor, loading the stored settings the first time it
   * opens.
   * @returns {Promise<void>} Resolves after the settings (if any) load.
   */
  const toggle = async (): Promise<void> => {
    const next = !open;
    setOpen(next);
    if (!next || view) return;
    try {
      const loaded = await bridgePromise(() => window.electronAPI.aiGetSettings());
      if (!loaded || typeof loaded !== 'object' || !isAiProviderId(loaded.providerId)) return;
      setView(loaded);
      setProviderId(loaded.providerId);
      setModel(typeof loaded.model === 'string' ? loaded.model : '');
      setBaseUrl(typeof loaded.baseUrl === 'string' ? loaded.baseUrl : '');
    } catch {
      // Hostile/unavailable bridge: keep the offline defaults.
    }
  };

  /**
   * Copies the clipboard text into the API-key field, if the clipboard is
   * readable. When it is not (permission denied, no clipboard), the user can
   * still paste manually with the keyboard.
   * @returns {Promise<void>} Resolves once the clipboard read settles.
   */
  const pasteKey = async (): Promise<void> => {
    try {
      const clip = navigator.clipboard;
      if (!clip || typeof clip.readText !== 'function') return;
      const text = await clip.readText();
      if (text) setApiKey(text.trim());
    } catch {
      // Clipboard unavailable or denied: fall back to manual paste.
    }
  };

  /**
   * Saves the current selection, then tests connectivity in one step. A failed
   * save short-circuits before any network call.
   * @returns {Promise<void>} Resolves once the flow settles.
   */
  const connect = async (): Promise<void> => {
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const updated = await bridgePromise(() =>
        window.electronAPI.aiSetSettings({
          providerId,
          model,
          ...(baseUrl ? { baseUrl } : {}),
          ...(apiKey ? { apiKey } : {}),
        }),
      );
      if (!updated || typeof updated !== 'object' || !isAiProviderId(updated.providerId)) {
        setError(t('settings.ai.saveFailed'));
        return;
      }
      setView(updated);
      setApiKey('');
      setStatus(t('settings.ai.testing'));
      const result = await bridgePromise(() =>
        window.electronAPI.aiConnectTest({
          providerId,
          model,
          ...(baseUrl ? { baseUrl } : {}),
        }),
      );
      if (result && typeof result.message === 'string') {
        const latency = typeof result.latencyMs === 'number' ? ` (${result.latencyMs} ms)` : '';
        setStatus(result.ok ? `${result.message}${latency}` : result.message);
      } else {
        setStatus(t('settings.ai.testFailed'));
      }
    } catch (err) {
      setError(formatError(err).message);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Persists the selected provider when it needs no configuration (the built-in
   * rules engine has no key/model/endpoint and no Connect button to save it).
   * Best-effort: a failed persist leaves the editor usable.
   * @param {AIProviderId} id - The provider id to store.
   * @returns {Promise<void>} Resolves once the save settles.
   */
  const persistProvider = async (id: AIProviderId): Promise<void> => {
    try {
      const updated = await bridgePromise(() => window.electronAPI.aiSetSettings({ providerId: id }));
      if (updated && typeof updated === 'object' && isAiProviderId(updated.providerId)) {
        setView(updated);
      }
    } catch {
      // Persisting the offline default is best-effort; keep the editor usable.
    }
  };

  /**
   * Selects a provider. Non-configurable providers (rules) are saved immediately
   * since they have no Connect button; the rest save when the user connects.
   * @param {AIProviderId} id - The provider to select.
   * @returns {void}
   */
  const selectProvider = (id: AIProviderId): void => {
    setProviderId(id);
    setStatus(null);
    setError(null);
    if (id === 'rules' && view?.providerId !== 'rules') void persistProvider(id);
  };

  const needsKey = AI_PROVIDERS_REQUIRING_KEY.has(providerId);
  const keyUrl = AI_PROVIDER_KEY_URLS[providerId];
  const showBaseUrl = providerId === 'openai' || providerId === 'local';
  // The built-in rules engine is offline: no key, no model call, no endpoint, so
  // it has nothing to connect to or configure.
  const configurable = providerId !== 'rules';

  return (
    <AiSettingsSection>
      <AiHeaderRow>
        <SettingsLabel variant="body1">{t('settings.ai.title')}</SettingsLabel>
        <Button size="small" startIcon={<FontAwesomeIcon icon={faGear} />} onClick={toggle} data-testid="settings-ai-toggle">
          {t('settings.ai.configure')}
        </Button>
      </AiHeaderRow>
      {open && (
        <AiWell data-testid="settings-ai">
          <ProviderGrid role="group" aria-label={t('settings.ai.provider')} data-testid="settings-ai-provider">
            {AI_PROVIDER_CHOICES.map((id) => (
              <ProviderButton
                key={id}
                type="button"
                $selected={id === providerId}
                aria-pressed={id === providerId}
                onClick={() => selectProvider(id)}
                data-testid={`settings-ai-provider-${id}`}
              >
                <ProviderIcon id={id} />
                <ProviderName>{t(`settings.ai.providers.${id}`)}</ProviderName>
              </ProviderButton>
            ))}
          </ProviderGrid>

          {configurable && (
            <>
              <AiKeyRow>
                {needsKey ? (
                  <McpField
                    type="password"
                    size="small"
                    label={t('settings.ai.apiKey')}
                    data-testid="settings-ai-key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={t('settings.ai.apiKeyPlaceholder')}
                    fullWidth
                    helperText={
                      <AiKeyHelper>
                        <span>{view?.hasKey ? t('settings.ai.keyStored', { hint: view.keyHint }) : t('settings.ai.keyNone')}</span>
                      </AiKeyHelper>
                    }
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <Tooltip title={t('settings.ai.paste')}>
                              <IconButton size="small" onClick={pasteKey} aria-label={t('settings.ai.paste')} data-testid="settings-ai-paste">
                                <FontAwesomeIcon icon={faPaste} />
                              </IconButton>
                            </Tooltip>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                ) : (
                  <McpField
                    size="small"
                    label={t('settings.ai.baseUrl')}
                    data-testid="settings-ai-base-url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder={t('settings.ai.baseUrlPlaceholder')}
                    fullWidth
                  />
                )}

                {keyUrl && (
                  <Button
                    size="small"
                    variant="outlined"
                    component="a"
                    href={keyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<FontAwesomeIcon icon={faArrowUpRightFromSquare} />}
                    data-testid="settings-ai-get-key"
                  >
                    {t('settings.ai.getKey')}
                  </Button>
                )}

                <Button size="small" variant="contained" onClick={connect} disabled={busy} data-testid="settings-ai-connect">
                  {busy ? t('settings.ai.connecting') : t('settings.ai.connect')}
                </Button>

                <Button
                  size="small"
                  variant="text"
                  onClick={() => setAdvanced((value) => !value)}
                  startIcon={<FontAwesomeIcon icon={advanced ? faChevronUp : faChevronDown} />}
                  data-testid="settings-ai-advanced"
                >
                  {t('settings.ai.advanced')}
                </Button>
              </AiKeyRow>

              {advanced && (
                <AdvancedPanel>
                  <McpField
                    size="small"
                    label={t('settings.ai.model')}
                    data-testid="settings-ai-model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder={t('settings.ai.modelPlaceholder')}
                  />
                  {showBaseUrl && needsKey && (
                    <McpField
                      size="small"
                      label={t('settings.ai.baseUrl')}
                      data-testid="settings-ai-base-url"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder={t('settings.ai.baseUrlPlaceholder')}
                    />
                  )}
                </AdvancedPanel>
              )}
            </>
          )}

          {status && (
            <AiAlert severity="info" data-testid="settings-ai-status">
              {status}
            </AiAlert>
          )}
          {error && (
            <AiAlert severity="error" data-testid="settings-ai-error">
              {error}
            </AiAlert>
          )}
          {configurable ? (
            <AiAlert severity="info" data-testid="settings-ai-privacy-note">
              {t('settings.ai.privacy')}
            </AiAlert>
          ) : (
            <AiAlert severity="info" data-testid="settings-ai-rules-note">
              {t('settings.ai.rulesNote')}
            </AiAlert>
          )}
        </AiWell>
      )}
    </AiSettingsSection>
  );
}
