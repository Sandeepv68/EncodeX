/**
 * @fileoverview AI-provider settings section for the Settings page
 * (AI connector plan §8).
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Autocomplete, Button, IconButton, Tooltip, InputAdornment } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWandMagicSparkles,
  faArrowUpRightFromSquare,
  faCheck,
  faChevronDown,
  faChevronUp,
  faPaste,
  faServer,
  faGear,
} from '@fortawesome/free-solid-svg-icons';
import { useColorMode } from '../../ColorModeContext';
import type { AiSettingsView } from '../../../shared/ai/settings';
import {
  AI_PROVIDER_CHOICES,
  AI_PROVIDERS_REQUIRING_KEY,
  AI_PROVIDERS_REQUIRING_NETWORK,
  isAiProviderId,
  selectedProviderOf,
  viewForProvider,
} from '../../../shared/ai/settings';
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
  ProviderSeparator,
  ProviderLogo,
  AiKeyHelper,
  AiKeyRow,
  AiField,
  AdvancedPanel,
  AiAlert,
  ConnectedDot,
  HeaderActions,
  HeaderStatus,
} from '../../styles/settings/AiProviderSettingsSection.styles';
import SettingLabel from './SettingLabel';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useAiSettingsStore } from '../../stores/aiSettingsStore';
import { activeConnectionOf, useAiConnectionStore } from '../../stores/aiConnectionStore';

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
 * store), so this section is the one direct-IPC exception on the page. The
 * editor loads the persisted settings when it mounts and restores the provider
 * the user last selected (and connected), so the previously chosen provider is
 * auto-selected instead of falling back to the offline default. The selection
 * itself is persisted on every provider click, which keeps the tile the user
 * left on top of the list selected across restarts without ever activating a
 * provider the user did not connect.
 *
 * Every bridge call goes through {@link bridgePromise} and a shape check, so a
 * missing, throwing, or garbage bridge leaves the form at its offline defaults
 * instead of crashing the tree. A warm session cache (this app session already
 * loaded the settings) restores the selection instantly, without a round-trip.
 * @returns {JSX.Element} The AI-provider settings rows.
 */
export default function AiProviderSettingsSection() {
  const { t } = useTranslation();
  const cached = useAiSettingsStore.getState();
  // The app hydrates the connection mirror at startup, so the provider the user
  // selected last is usually known before the page mounts. The session cache
  // wins when it is warmer (a remount inside the same session).
  const initialView = cached.view ?? useAiConnectionStore.getState().view ?? null;
  const initialSelection = initialView ? (selectedProviderOf(initialView) ?? initialView.providerId) : cached.providerId;
  const initialTarget = initialView ? viewForProvider(initialView, initialSelection) : null;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<AiSettingsView | null>(initialView);
  const [providerId, setProviderId] = useState<AIProviderId>(initialSelection);
  const [model, setModel] = useState(initialTarget?.model ?? cached.model);
  const [baseUrl, setBaseUrl] = useState(initialTarget?.baseUrl ?? cached.baseUrl);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [advancedByProvider, setAdvancedByProvider] = useState<Partial<Record<AIProviderId, boolean>>>({});
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [fellBackOffline, setFellBackOffline] = useState(false);
  const online = useOnlineStatus();
  // The in-flight (or finished) settings load, so a second expand does not
  // race the first one.
  const loadRef = useRef<Promise<AiSettingsView | null> | null>(null);

  useEffect(() => {
    useAiSettingsStore.getState().patch({ view, providerId, model, baseUrl });
  }, [view, providerId, model, baseUrl]);

  /**
   * Adopts a freshly loaded or saved settings view, locally and in the session
   * cache, so the collapsed header and a later remount stay in sync.
   * @param {AiSettingsView} next - The view to adopt.
   * @returns {void}
   */
  const applyView = (next: AiSettingsView): void => {
    setView(next);
    useAiSettingsStore.getState().patch({ view: next });
    useAiConnectionStore.getState().patch(next);
  };

  /**
   * Loads the persisted AI settings into the session cache. The load is shared:
   * a second call (e.g. expanding the editor while a load is still running)
   * reuses the pending round-trip, and a failed load is forgotten so a later
   * expand can retry it. Only the caches are touched - the editor is collapsed
   * at that point, so the restored selection becomes visible when the user
   * opens it.
   * @returns {Promise<AiSettingsView | null>} The loaded view, or null when the
   *   bridge could not be used.
   */
  const loadSettings = (): Promise<AiSettingsView | null> => {
    if (loadRef.current) return loadRef.current;
    const pending = (async (): Promise<AiSettingsView | null> => {
      try {
        const loaded = await bridgePromise(() => window.electronAPI.aiGetSettings());
        if (!loaded || typeof loaded !== 'object' || !isAiProviderId(loaded.providerId)) {
          loadRef.current = null;
          return null;
        }
        useAiSettingsStore.getState().patch({ view: loaded });
        useAiConnectionStore.getState().patch(loaded);
        return loaded;
      } catch {
        // Hostile/unavailable bridge: keep the offline defaults and let a
        // later expand retry the load.
        loadRef.current = null;
        return null;
      }
    })();
    loadRef.current = pending;
    return pending;
  };

  useEffect(() => {
    // Restore the persisted selection in the background when the app did not
    // hydrate a mirror before this page mounted. The editor itself stays
    // collapsed until the user asks for it.
    if (!initialView) void loadSettings();
  }, []);

  /**
   * Restores the persisted provider selection into the form: the tile the user
   * selected last becomes the selected one, showing that provider's own model
   * and endpoint.
   * @param {AiSettingsView} next - The view to restore from.
   * @returns {void}
   */
  const restoreSelection = (next: AiSettingsView): void => {
    const selected = selectedProviderOf(next) ?? next.providerId;
    const target = viewForProvider(next, selected);
    setView(next);
    setProviderId(selected);
    setModel(typeof target.model === 'string' ? target.model : '');
    setBaseUrl(typeof target.baseUrl === 'string' ? target.baseUrl : '');
  };

  /**
   * Expands/collapses the editor. Expanding restores the provider the user
   * selected last from the cached view (the app already knows it at startup, so
   * usually no round-trip is needed); when nothing is cached yet the stored
   * settings load first.
   * @returns {Promise<void>} Resolves after the settings (if any) load.
   */
  const toggle = async (): Promise<void> => {
    const next = !open;
    setOpen(next);
    if (!next) return;
    const cachedView = useAiSettingsStore.getState().view;
    if (cachedView) {
      restoreSelection(cachedView);
      return;
    }
    const loaded = await loadSettings();
    if (loaded) restoreSelection(loaded);
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
      applyView(updated);
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
        if (result.ok) {
          const refreshed = result.view;
          if (refreshed && typeof refreshed === 'object' && isAiProviderId(refreshed.providerId)) applyView(refreshed);
          if (advanced) void loadModels();
          const latency = typeof result.latencyMs === 'number' ? ` (${result.latencyMs} ms)` : '';
          setStatus(`${result.message}${latency}`);
        } else if (typeof result.reason === 'string') {
          // Show a localized message for the classified provider failure instead
          // of the raw payload returned by the service.
          setStatus(null);
          setError(t(`settings.ai.errors.${result.reason}`, { status: result.status ?? '' }));
        } else {
          setStatus(null);
          setError(t('settings.ai.testFailed'));
        }
      } else {
        setStatus(null);
        setError(t('settings.ai.testFailed'));
      }
    } catch (err) {
      setError(formatError(err).message);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Removes the stored API key of the provider the editor shows. The key is
   * stored encrypted in main and only ever surfaced as `hasKey`/`keyHint`, so
   * removal is the only way to undo a saved key from the UI. The key belongs
   * to the selected provider, so the active provider is left alone when the
   * two differ. Best-effort: an unusable bridge surfaces as a save error and
   * leaves the editor open.
   * @returns {Promise<void>} Resolves once the flow settles.
   */
  const removeKey = async (): Promise<void> => {
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const active = !view || view.providerId === providerId;
      const updated = await bridgePromise(() =>
        window.electronAPI.aiSetSettings({
          providerId,
          clearKey: true,
          ...(active ? {} : { activate: false }),
        }),
      );
      if (!updated || typeof updated !== 'object' || !isAiProviderId(updated.providerId)) {
        setError(t('settings.ai.saveFailed'));
        return;
      }
      applyView(updated);
      setApiKey('');
      setStatus(t('settings.ai.keyRemoved'));
    } catch (err) {
      setError(formatError(err).message);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Persists the provider the user selected, so the editor restores it (and
   * the connected provider it belongs to) on the next start. Selecting a
   * remote provider never activates it for the Copilot - only the built-in
   * rules engine, the offline fallback, switches the active provider exactly
   * as before - so browsing the provider list cannot silently change the
   * provider the Copilot plans with. Best-effort: a failed persist leaves the
   * editor usable.
   * @param {AIProviderId} id - The provider id to store.
   * @returns {Promise<void>} Resolves once the save settles.
   */
  const persistSelection = async (id: AIProviderId): Promise<void> => {
    try {
      const updated = await bridgePromise(() =>
        window.electronAPI.aiSetSettings(id === 'rules' ? { providerId: id } : { providerId: id, activate: false }),
      );
      if (!updated || typeof updated !== 'object' || !isAiProviderId(updated.providerId)) return;
      applyView(updated);
    } catch {
      // Persisting the selection is best-effort; keep the editor usable.
    }
  };

  /**
   * Selects a provider for editing. The choice is persisted (so the app comes
   * back to it) but never activates a remote provider for the Copilot: only
   * the built-in rules engine - which has no Connect button and is the
   * offline fallback - is saved as the active provider. The key/model/endpoint
   * shown are resolved from that provider's own stored config, so switching
   * providers cannot leak the previous provider's saved-key state.
   * @param {AIProviderId} id - The provider to select.
   * @returns {void}
   */
  const selectProvider = (id: AIProviderId): void => {
    setProviderId(id);
    setApiKey('');
    setStatus(null);
    setError(null);
    setModelOptions([]);
    const target = view ? viewForProvider(view, id) : null;
    setModel(target?.model ?? '');
    setBaseUrl(target?.baseUrl ?? '');
    void persistSelection(id);
  };

  const toggleAdvanced = (): void => {
    setAdvancedByProvider((prev) => ({ ...prev, [providerId]: !prev[providerId] }));
  };

  const advanced = advancedByProvider[providerId] === true;

  const needsKey = AI_PROVIDERS_REQUIRING_KEY.has(providerId);
  const keyUrl = AI_PROVIDER_KEY_URLS[providerId];
  const showBaseUrl = providerId === 'openai' || providerId === 'local';
  const resolvedView = view ? viewForProvider(view, providerId) : null;
  const active = activeConnectionOf(view);
  const showConnected = active?.providerId === providerId;
  const dirty = showConnected && (apiKey !== '' || model !== (resolvedView?.model ?? '') || baseUrl !== (resolvedView?.baseUrl ?? ''));
  const connectedNow = showConnected && !error && !dirty;
  const keySaved = resolvedView?.hasKey === true && apiKey === '';
  const configurable = providerId !== 'rules';
  const hasKeyForProvider = resolvedView?.hasKey === true;
  const canListModels = needsKey ? hasKeyForProvider || apiKey.trim().length > 0 : true;

  useEffect(() => {
    if (online) {
      setFellBackOffline(false);
      return;
    }
    if (AI_PROVIDERS_REQUIRING_NETWORK.has(providerId)) {
      setProviderId('rules');
      setFellBackOffline(true);
      void persistSelection('rules');
    }
  }, [online, providerId]);

  const loadModels = async (): Promise<void> => {
    if (!configurable || !AI_PROVIDERS_REQUIRING_NETWORK.has(providerId)) {
      setModelOptions([]);
      return;
    }
    if (!canListModels) {
      setModelOptions([]);
      return;
    }
    setModelsLoading(true);
    try {
      const result = await bridgePromise(() =>
        window.electronAPI.aiListModels({
          providerId,
          ...(baseUrl ? { baseUrl } : {}),
          ...(apiKey ? { apiKey } : {}),
        }),
      );
      if (result && typeof result === 'object' && Array.isArray(result.models)) {
        setModelOptions(result.models);
      } else {
        setModelOptions([]);
      }
    } catch {
      setModelOptions([]);
    } finally {
      setModelsLoading(false);
    }
  };

  useEffect(() => {
    if (advanced) void loadModels();
  }, [advanced, providerId, baseUrl, resolvedView?.hasKey, apiKey]);

  return (
    <AiSettingsSection>
      <AiHeaderRow>
        <SettingsLabel variant="body1">{t('settings.ai.title')}</SettingsLabel>
        <HeaderActions>
          {!open && active && (
            <HeaderStatus data-testid="settings-ai-header-status">
              <ConnectedDot aria-hidden="true" />
              {t('settings.ai.headerConnected', {
                provider: t(`settings.ai.providers.${active.providerId}`),
                model: active.model || t('settings.ai.modelPlaceholder'),
              })}
            </HeaderStatus>
          )}
          <Button size="small" startIcon={<FontAwesomeIcon icon={faGear} />} onClick={toggle} data-testid="settings-ai-toggle">
            {t('settings.ai.configure')}
          </Button>
        </HeaderActions>
      </AiHeaderRow>
      {open && (
        <AiWell data-testid="settings-ai">
          <ProviderGrid role="group" aria-label={t('settings.ai.provider')} data-testid="settings-ai-provider">
            {AI_PROVIDER_CHOICES.map((id) => {
              const isRemote = AI_PROVIDERS_REQUIRING_NETWORK.has(id);
              const disabled = isRemote && !online;
              const button = (
                <ProviderButton
                  key={id}
                  type="button"
                  $selected={id === providerId}
                  aria-pressed={id === providerId}
                  onClick={() => selectProvider(id)}
                  data-testid={`settings-ai-provider-${id}`}
                  disabled={disabled}
                >
                  <ProviderIcon id={id} />
                  <ProviderSeparator aria-hidden="true" />
                  <ProviderName>{t(`settings.ai.providers.${id}`)}</ProviderName>
                  {active?.providerId === id && <ConnectedDot aria-hidden="true" data-testid={`settings-ai-connected-dot-${id}`} />}
                </ProviderButton>
              );
              if (disabled) {
                return (
                  <Tooltip key={id} title={t('settings.ai.requiresNetwork')} placement="top">
                    <span>{button}</span>
                  </Tooltip>
                );
              }
              return button;
            })}
          </ProviderGrid>

          {configurable && (
            <>
              <AiField>
                <SettingLabel
                  text={needsKey ? t('settings.ai.apiKey') : t('settings.ai.baseUrl')}
                  hint={needsKey ? t('settings.ai.apiKeyHint') : t('settings.ai.baseUrlHint')}
                />
                <AiKeyRow>
                  {needsKey ? (
                    <McpField
                      type="password"
                      size="small"
                      data-testid="settings-ai-key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={keySaved ? t('settings.ai.keySavedPlaceholder') : t('settings.ai.apiKeyPlaceholder')}
                      fullWidth
                      helperText={
                        <AiKeyHelper $saved={keySaved}>
                          <span>
                            {resolvedView?.hasKey
                              ? keySaved
                                ? t('settings.ai.keySaved', { hint: resolvedView.keyHint })
                                : t('settings.ai.keyStored', { hint: resolvedView.keyHint })
                              : t('settings.ai.keyNone')}
                          </span>
                        </AiKeyHelper>
                      }
                      slotProps={{
                        htmlInput: { 'aria-label': t('settings.ai.apiKey') },
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              <Tooltip title={t('settings.ai.paste')}>
                                <IconButton
                                  size="small"
                                  onClick={pasteKey}
                                  aria-label={t('settings.ai.paste')}
                                  data-testid="settings-ai-paste"
                                >
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
                      data-testid="settings-ai-base-url"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder={t('settings.ai.baseUrlPlaceholder')}
                      slotProps={{ htmlInput: { 'aria-label': t('settings.ai.baseUrl') } }}
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

                  {needsKey && resolvedView?.hasKey && (
                    <Button
                      size="small"
                      variant="text"
                      color="error"
                      onClick={removeKey}
                      disabled={busy}
                      data-testid="settings-ai-remove-key"
                    >
                      {t('settings.ai.removeKey')}
                    </Button>
                  )}

                  <Button
                    size="small"
                    variant="contained"
                    color={connectedNow ? 'success' : 'primary'}
                    onClick={connect}
                    disabled={busy}
                    startIcon={connectedNow ? <FontAwesomeIcon icon={faCheck} /> : undefined}
                    title={connectedNow ? t('settings.ai.testAgain') : undefined}
                    data-testid="settings-ai-connect"
                  >
                    {busy ? t('settings.ai.connecting') : connectedNow ? t('settings.ai.connected') : t('settings.ai.connect')}
                  </Button>

                  <Button
                    size="small"
                    variant="text"
                    onClick={toggleAdvanced}
                    startIcon={<FontAwesomeIcon icon={advanced ? faChevronUp : faChevronDown} />}
                    data-testid="settings-ai-advanced"
                  >
                    {t('settings.ai.advanced')}
                  </Button>
                </AiKeyRow>
              </AiField>

              {advanced && (
                <AdvancedPanel>
                  <AiField>
                    <SettingLabel text={t('settings.ai.model')} hint={t('settings.ai.modelHint')} />
                    <Autocomplete
                      freeSolo
                      size="small"
                      options={modelOptions}
                      loading={modelsLoading}
                      disabled={needsKey && !canListModels}
                      value={model}
                      onChange={(_event, value) => setModel(typeof value === 'string' ? value : '')}
                      onInputChange={(_event, value) => setModel(value)}
                      data-testid="settings-ai-model"
                      renderInput={(params) => (
                        <McpField
                          {...params}
                          placeholder={
                            needsKey && !canListModels ? t('settings.ai.modelPlaceholderNoKey') : t('settings.ai.modelPlaceholder')
                          }
                          helperText={needsKey && !canListModels ? t('settings.ai.modelNoKeyHelp') : undefined}
                          slotProps={{
                            ...params.slotProps,
                            htmlInput: { ...params.slotProps.htmlInput, 'aria-label': t('settings.ai.model') },
                          }}
                        />
                      )}
                    />
                  </AiField>
                  {showBaseUrl && needsKey && (
                    <AiField>
                      <SettingLabel text={t('settings.ai.baseUrl')} hint={t('settings.ai.baseUrlHint')} />
                      <McpField
                        size="small"
                        data-testid="settings-ai-base-url"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder={t('settings.ai.baseUrlPlaceholder')}
                        slotProps={{ htmlInput: { 'aria-label': t('settings.ai.baseUrl') } }}
                      />
                    </AiField>
                  )}
                </AdvancedPanel>
              )}
            </>
          )}

          {fellBackOffline && (
            <AiAlert severity="info" data-testid="settings-ai-offline-fallback">
              {t('settings.ai.offlineFallback')}
            </AiAlert>
          )}
          {connectedNow && (
            <AiAlert severity="success" data-testid="settings-ai-connected">
              {t('settings.ai.statusConnected')}
            </AiAlert>
          )}
          {dirty && !error && (
            <AiAlert severity="warning" data-testid="settings-ai-stale">
              {t('settings.ai.staleStatus')}
            </AiAlert>
          )}
          {status && !connectedNow && !dirty && (
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
