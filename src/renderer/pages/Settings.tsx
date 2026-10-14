/**
 * @fileoverview Settings page. Configures the app-wide appearance and conversion
 * defaults. Corresponds to the `/settings` route and is reached from the
 * navigation bar.
 *
 * The page groups settings into sections: a theme picker (rendered as preview
 * cards from `THEMES`, persisted through `useColorMode`), an "always on top"
 * switch and a "launch at startup" switch (delegated to the main process), and
 * the hardware-acceleration options (enable/disable plus hwaccel mode and
 * encoder type selects). Every persisted value lives in the `useSettingsStore`
 * zustand store, which synchronizes it to disk and to the main process; this
 * page only reads and writes store state and makes no direct IPC calls.
 *
 * The one exception is the AI-provider section (AI connector plan §8): provider
 * settings live in `userData/ai-settings.json` rather than the settings store,
 * so that section talks to the `ai-*` preload bridge directly, guarded by
 * {@link bridgePromise} so a hostile bridge degrades to offline defaults.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, Switch, MenuItem, IconButton, Tooltip, Typography, InputAdornment, Link } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCopy,
  faEye,
  faEyeSlash,
  faTrashCan,
  faWandMagicSparkles,
  faGear,
  faArrowUpRightFromSquare,
  faChevronDown,
  faChevronUp,
  faPaste,
  faServer,
} from '@fortawesome/free-solid-svg-icons';
import { useColorMode } from '../ColorModeContext';
import { useSettingsStore } from '../stores/settingsStore';
import { useToastStore } from '../stores/toastStore';
import InfoTooltip from '../components/InfoTooltip';
import { HWACCEL_MODES, ENCODER_TYPES } from '../../shared/hwaccel-settings';
import { MCP_MIN_PORT, MCP_MAX_PORT, MCP_DEFAULT_PORT, clampMcpPort } from '../../shared/mcp-settings';
import { recordAnalyticsEvent } from '../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../shared/analytics/events';
import { THEMES } from '../colors';
import type { ThemeDefinition } from '../colors';
import type { HwAccelMode, EncoderType } from '../../shared/types';
import type { AiSettingsView } from '../../shared/ai/settings';
import { AI_PROVIDER_CHOICES, AI_PROVIDERS_REQUIRING_KEY, isAiProviderId } from '../../shared/ai/settings';
import type { AIProviderId } from '../../shared/ai/types';
import { bridgePromise } from '../utils/bridge-call';
import { aiProviderLogo } from '../utils/ai-provider-icons';
import { formatError } from '../../shared/errors';
import {
  SettingsRoot,
  SettingsHeader,
  SettingsTitle,
  SettingsSection,
  ThemeSettingsSection,
  SettingsLabel,
  SettingsLabelRow,
  ModeSelect,
  ModeSettingsSection,
  McpField,
  McpValueRow,
  ThemeSwitcher,
  ThemeCard,
  ThemePreview,
  ThemePreviewPaper,
  ThemePreviewTextBar,
  ThemePreviewAccentBar,
  AiSettingsSection,
  AiHeaderRow,
  AiWell,
  ProviderGrid,
  ProviderButton,
  ProviderName,
  ProviderLogo,
  AiKeyHelper,
  AiActionRow,
  AdvancedPanel,
  AiAlert,
} from '../styles/Settings.styles';
import { ToggleRow } from '../styles/form.styles';
import { TitleIcon } from '../styles/PageContainer.styles';
import { pageIcons } from '../pageIcons';

/**
 * Maps each hardware-acceleration mode value to the translation key of its
 * label, read under the `settings.` namespace.
 * @const {Record<HwAccelMode, string>}
 */
const hwaccelModeLabel: Record<HwAccelMode, string> = {
  auto: 'settings.hwaccelModeAuto',
  encode: 'settings.hwaccelModeEncode',
};

import { encoderTypeLabel } from '../utils/encoding-option-utils';
import { generateMcpToken } from '../utils/security-utils';

/**
 * Website URL of the AI use-case documentation, linked from the MCP server
 * settings once the embedded server is enabled.
 * @const {string} MCP_AI_USE_CASES_URL
 */
const MCP_AI_USE_CASES_URL = 'https://encodex.in/features#let-an-ai-assistant-drive';

/**
 * Renders a settings row consisting of a label and its info tooltip. Used to
 * keep label + hint layout consistent across every settings section.
 * @param {Object} props - Component props.
 * @param {string} props.text - The translated label text.
 * @param {string} props.hint - The translated hint shown in the tooltip.
 * @returns {JSX.Element} A label row with an info tooltip.
 */
function SettingLabel({ text, hint }: { text: string; hint: string }) {
  return (
    <SettingsLabelRow>
      <SettingsLabel variant="body1">{text}</SettingsLabel>
      <InfoTooltip title={hint} />
    </SettingsLabelRow>
  );
}

/**
 * Renders a miniature color-swatch preview for one theme. Two text bars sit on
 * a paper background above two accent bars taken from the theme's primary and
 * secondary colors.
 * @param {Object} props - Component props.
 * @param {ThemeDefinition} props.theme - The theme whose colors are previewed.
 * @returns {JSX.Element} The theme preview card body.
 */
function ThemePreviewCard({ theme }: { theme: ThemeDefinition }) {
  return (
    <ThemePreview $backgroundColor={theme.background.default}>
      <ThemePreviewPaper $color={theme.background.paper}>
        <ThemePreviewTextBar $color={theme.text.primary} $width="60%" />
        <ThemePreviewTextBar $color={theme.text.secondary} $width="85%" />
      </ThemePreviewPaper>
      <ThemePreviewAccentBar $color={theme.primary} />
      <ThemePreviewAccentBar $color={theme.secondary} />
    </ThemePreview>
  );
}

/**
 * Renders a copy-to-clipboard button for a read-only MCP connection value.
 * @param {Object} props - Component props.
 * @param {string} props.value - The value copied to the clipboard.
 * @param {string} props.label - Translated aria-label / tooltip text.
 * @param {string} props.testId - Stable test id for the copy icon button.
 * @param {(value: string) => Promise<void>} props.onCopy - Callback used to copy.
 * @returns {JSX.Element} A tooltip-wrapped copy button.
 */
function CopyButton({
  value,
  label,
  testId,
  onCopy,
}: {
  value: string;
  label: string;
  testId: string;
  onCopy: (value: string) => Promise<void>;
}) {
  return (
    <Tooltip title={label}>
      <IconButton size="small" aria-label={label} data-testid={testId} onClick={() => void onCopy(value)}>
        <FontAwesomeIcon icon={faCopy} />
      </IconButton>
    </Tooltip>
  );
}

/**
 * Renders the embedded MCP server settings: an enable switch plus (when
 * enabled) the loopback port and the optional bearer-token row. The token row
 * collapses to a single generate action until a token exists; once set it shows
 * the generate button, a masked field with a reveal/hide toggle, a copy button,
 * and a clear button. A read-only connection-details block shows the live
 * endpoint URL (and the `Authorization` header when a token is configured) with
 * copy buttons. The port and token inputs keep local draft state and commit to
 * the store on blur or Enter, so typing never triggers an IPC round-trip (and
 * therefore never restarts the HTTP server) per keystroke.
 * @returns {JSX.Element} The MCP server settings rows.
 */
function McpSettingsSection() {
  const { t } = useTranslation();
  const enabled = useSettingsStore((s) => s.mcpEnabled);
  const port = useSettingsStore((s) => s.mcpPort);
  const token = useSettingsStore((s) => s.mcpToken);
  const setMcpEnabled = useSettingsStore((s) => s.setMcpEnabled);
  const setMcpPort = useSettingsStore((s) => s.setMcpPort);
  const setMcpToken = useSettingsStore((s) => s.setMcpToken);

  const [portText, setPortText] = useState(String(port));
  const [tokenText, setTokenText] = useState(token);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => setPortText(String(port)), [port]);
  useEffect(() => setTokenText(token), [token]);

  const commitPort = () => {
    const parsed = Number.parseInt(portText, 10);
    if (Number.isInteger(parsed)) {
      // Clamp locally so the field immediately reflects the authoritative
      // value: out-of-range drafts (e.g. "80") snap to the canonical port even
      // when the main process returns the same value we already hold (a
      // no-change zustand update would otherwise leave the invalid draft in the
      // input). The main process independently clamps as a backstop.
      const clamped = clampMcpPort(parsed);
      setMcpPort(clamped);
      setPortText(String(clamped));
      recordAnalyticsEvent(createAnalyticsEvent('mcp_port_committed', { isDefaultPort: clamped === MCP_DEFAULT_PORT }));
    } else setPortText(String(port));
  };

  /**
   * Replaces the draft and committed token with a freshly generated secure
   * value so the server starts requiring it immediately.
   * @returns {void}
   */
  const handleGenerateToken = () => {
    const generated = generateMcpToken();
    setTokenText(generated);
    setShowToken(false);
    setMcpToken(generated);
    recordAnalyticsEvent(createAnalyticsEvent('mcp_token_generated', {}));
  };

  /**
   * Clears the draft and committed token so the row collapses back to just the
   * generate action, and the server stops requiring a bearer credential.
   * @returns {void}
   */
  const handleClearToken = () => {
    setTokenText('');
    setShowToken(false);
    setMcpToken('');
    recordAnalyticsEvent(createAnalyticsEvent('mcp_token_cleared', {}));
  };

  const hasToken = token.length > 0;
  const endpoint = `http://127.0.0.1:${port}/mcp`;
  const authorization = `Bearer ${token}`;

  /**
   * Copies a connection detail value to the clipboard, records which value type
   * was copied, and confirms via a toast.
   * @param {string} value - The value to copy.
   * @param {('token'|'endpoint'|'authorization')} valueType - Which kind of connection value is copied.
   * @returns {Promise<void>} Resolves once the value is copied (or fails).
   */
  const copyConnectionValue = async (value: string, valueType: 'token' | 'endpoint' | 'authorization'): Promise<void> => {
    await navigator.clipboard.writeText(value);
    recordAnalyticsEvent(createAnalyticsEvent('mcp_connection_value_copied', { valueType }));
    useToastStore.getState().success(t('settings.mcpCopied'));
  };

  return (
    <>
      <SettingsSection>
        <ToggleRow>
          <Switch
            checked={enabled}
            onChange={(e) => {
              setMcpEnabled(e.target.checked);
              recordAnalyticsEvent(createAnalyticsEvent('mcp_server_toggled', { enabled: e.target.checked }));
            }}
            slotProps={{ input: { 'aria-label': t('settings.mcpServer'), 'data-testid': 'settings-mcp-server' } }}
          />
          <SettingLabel text={t('settings.mcpServer')} hint={t('settings.mcpServerHint')} />
        </ToggleRow>
        {enabled && (
          <Link href={MCP_AI_USE_CASES_URL} target="_blank" rel="noopener noreferrer" data-testid="settings-mcp-ai-use-cases-link">
            {t('settings.mcpAiUseCases')}
          </Link>
        )}
      </SettingsSection>
      {enabled && (
        <ModeSettingsSection>
          <SettingLabel text={t('settings.mcpPort')} hint={t('settings.mcpPortHint')} />
          <McpField
            type="number"
            size="small"
            data-testid="settings-mcp-port"
            slotProps={{ htmlInput: { 'aria-label': t('settings.mcpPort'), min: MCP_MIN_PORT, max: MCP_MAX_PORT } }}
            value={portText}
            onChange={(e) => setPortText(e.target.value)}
            onBlur={commitPort}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitPort();
            }}
          />
        </ModeSettingsSection>
      )}
      {enabled && (
        <ModeSettingsSection>
          <SettingLabel text={t('settings.mcpToken')} hint={t('settings.mcpTokenHint')} />
          <McpValueRow>
            <Box sx={hasToken ? undefined : { marginLeft: 'auto' }}>
              <Tooltip title={t('settings.mcpTokenGenerate')}>
                <IconButton
                  size="small"
                  aria-label={t('settings.mcpTokenGenerate')}
                  data-testid="settings-mcp-generate-token"
                  onClick={handleGenerateToken}
                >
                  <FontAwesomeIcon icon={faWandMagicSparkles} />
                </IconButton>
              </Tooltip>
            </Box>
            {hasToken && (
              <McpField
                type={showToken ? 'text' : 'password'}
                size="small"
                data-testid="settings-mcp-token"
                slotProps={{
                  htmlInput: { 'aria-label': t('settings.mcpToken') },
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={showToken ? t('settings.mcpTokenHide') : t('settings.mcpTokenReveal')}>
                          <IconButton
                            size="small"
                            aria-label={showToken ? t('settings.mcpTokenHide') : t('settings.mcpTokenReveal')}
                            data-testid="settings-mcp-token-visibility"
                            onClick={() => setShowToken((prev) => !prev)}
                          >
                            <FontAwesomeIcon icon={showToken ? faEyeSlash : faEye} />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  },
                }}
                value={tokenText}
                onChange={(e) => setTokenText(e.target.value)}
                onBlur={() => setMcpToken(tokenText)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setMcpToken(tokenText);
                }}
              />
            )}
            {hasToken && (
              <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CopyButton
                  value={token}
                  label={t('settings.mcpCopy')}
                  testId="settings-mcp-token-copy"
                  onCopy={(v) => copyConnectionValue(v, 'token')}
                />
                <Tooltip title={t('settings.mcpTokenClear')}>
                  <IconButton
                    size="small"
                    aria-label={t('settings.mcpTokenClear')}
                    data-testid="settings-mcp-clear-token"
                    onClick={handleClearToken}
                  >
                    <FontAwesomeIcon icon={faTrashCan} />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </McpValueRow>
        </ModeSettingsSection>
      )}
      {enabled && (
        <ModeSettingsSection>
          <SettingLabel text={t('settings.mcpEndpoint')} hint={t('settings.mcpEndpointHint')} />
          <McpValueRow>
            <McpField
              size="small"
              value={endpoint}
              data-testid="settings-mcp-endpoint"
              slotProps={{ htmlInput: { 'aria-label': t('settings.mcpEndpoint'), readOnly: true } }}
            />
            <CopyButton
              value={endpoint}
              label={t('settings.mcpCopy')}
              testId="settings-mcp-copy-endpoint"
              onCopy={(v) => copyConnectionValue(v, 'endpoint')}
            />
          </McpValueRow>
        </ModeSettingsSection>
      )}
      {enabled && token && (
        <ModeSettingsSection>
          <SettingLabel text={t('settings.mcpAuthorization')} hint={t('settings.mcpAuthorizationHint')} />
          <McpValueRow>
            <McpField
              size="small"
              value={authorization}
              data-testid="settings-mcp-authorization"
              slotProps={{ htmlInput: { 'aria-label': t('settings.mcpAuthorization'), readOnly: true } }}
            />
            <CopyButton
              value={authorization}
              label={t('settings.mcpCopy')}
              testId="settings-mcp-copy-token"
              onCopy={(v) => copyConnectionValue(v, 'authorization')}
            />
          </McpValueRow>
        </ModeSettingsSection>
      )}
    </>
  );
}

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
function AiProviderSettingsSection() {
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

          {configurable &&
            (needsKey ? (
              <McpField
                type="password"
                size="small"
                label={t('settings.ai.apiKey')}
                data-testid="settings-ai-key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={t('settings.ai.apiKeyPlaceholder')}
                helperText={
                  <AiKeyHelper>
                    <span>{view?.hasKey ? t('settings.ai.keyStored', { hint: view.keyHint }) : t('settings.ai.keyNone')}</span>
                    {keyUrl && (
                      <Link
                        href={keyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="body2"
                        underline="hover"
                        data-testid="settings-ai-get-key"
                      >
                        <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                        {t('settings.ai.getKey')}
                      </Link>
                    )}
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
              />
            ))}

          {configurable && (
            <>
              <AiActionRow>
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
              </AiActionRow>

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
            <Typography variant="caption" color="text.secondary" data-testid="settings-ai-status">
              {status}
            </Typography>
          )}
          {error && (
            <AiAlert severity="error" data-testid="settings-ai-error">
              {error}
            </AiAlert>
          )}
          {configurable ? (
            <Typography variant="caption" color="text.secondary">
              {t('settings.ai.privacy')}
            </Typography>
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

/**
 * Renders the settings page (`/settings`).
 *
 * Layout: a theme section whose cards call `setTheme` from `useColorMode`, and
 * `SettingsSection`s for the "always on top" and "launch at startup" switches,
 * the error-reporting switch, the embedded MCP server rows, the
 * hardware-acceleration enable switch, and (only when acceleration is enabled)
 * the hwaccel-mode and encoder-type selects. All values are bound one-way to
 * `useSettingsStore`; store setters update persisted state and the main process
 * automatically.
 *
 * The AI-provider section is the one exception and calls the `ai-*` bridge
 * directly; all other settings are store-backed.
 *
 * @returns {JSX.Element} The page content.
 */
export default function Settings() {
  const { t } = useTranslation();
  const { themeId, setTheme } = useColorMode();
  const hardwareAcceleration = useSettingsStore((s) => s.hardwareAcceleration);
  const hwaccelMode = useSettingsStore((s) => s.hwaccelMode);
  const encoderType = useSettingsStore((s) => s.encoderType);
  const alwaysOnTop = useSettingsStore((s) => s.alwaysOnTop);
  const launchAtLogin = useSettingsStore((s) => s.launchAtLogin);
  const monitoringEnabled = useSettingsStore((s) => s.monitoringEnabled);
  const setHardwareAcceleration = useSettingsStore((s) => s.setHardwareAcceleration);
  const setHwaccelMode = useSettingsStore((s) => s.setHwaccelMode);
  const setEncoderType = useSettingsStore((s) => s.setEncoderType);
  const setAlwaysOnTop = useSettingsStore((s) => s.setAlwaysOnTop);
  const setLaunchAtLogin = useSettingsStore((s) => s.setLaunchAtLogin);
  const setTelemetryEnabled = useSettingsStore((s) => s.setTelemetryEnabled);

  return (
    <SettingsRoot>
      <SettingsHeader>
        <SettingsTitle variant="h5" component="h1">
          <TitleIcon>{pageIcons['/settings']}</TitleIcon>
          {t('settings.title')}
        </SettingsTitle>
      </SettingsHeader>
      <ThemeSettingsSection>
        <SettingsLabel variant="body1">{t('settings.theme')}</SettingsLabel>
        <ThemeSwitcher>
          {THEMES.map((theme) => {
            const selected = theme.id === themeId;
            return (
              <ThemeCard
                key={theme.id}
                $selected={selected}
                aria-pressed={selected}
                data-testid={`settings-theme-${theme.id}`}
                onClick={() => setTheme(theme.id)}
              >
                <ThemePreviewCard theme={theme} />
                <Box component="span">{t(theme.labelKey)}</Box>
              </ThemeCard>
            );
          })}
        </ThemeSwitcher>
      </ThemeSettingsSection>
      <SettingsSection>
        <ToggleRow>
          <Switch
            checked={alwaysOnTop}
            onChange={(e) => {
              setAlwaysOnTop(e.target.checked);
              recordAnalyticsEvent(createAnalyticsEvent('always_on_top_toggled', { enabled: e.target.checked }));
            }}
            slotProps={{ input: { 'aria-label': t('settings.alwaysOnTop'), 'data-testid': 'settings-always-on-top' } }}
          />
          <SettingLabel text={t('settings.alwaysOnTop')} hint={t('settings.alwaysOnTopHint')} />
        </ToggleRow>
      </SettingsSection>
      <SettingsSection>
        <ToggleRow>
          <Switch
            checked={launchAtLogin}
            onChange={(e) => {
              setLaunchAtLogin(e.target.checked);
              recordAnalyticsEvent(createAnalyticsEvent('launch_at_login_toggled', { enabled: e.target.checked }));
            }}
            slotProps={{ input: { 'aria-label': t('settings.launchAtLogin'), 'data-testid': 'settings-launch-at-login' } }}
          />
          <SettingLabel text={t('settings.launchAtLogin')} hint={t('settings.launchAtLoginHint')} />
        </ToggleRow>
      </SettingsSection>
      <SettingsSection>
        <ToggleRow>
          <Switch
            checked={monitoringEnabled}
            onChange={(e) => setTelemetryEnabled(e.target.checked)}
            slotProps={{
              input: { 'aria-label': t('settings.telemetry'), 'data-testid': 'settings-monitoring-error-reporting' },
            }}
          />
          <SettingLabel text={t('settings.telemetry')} hint={t('settings.telemetryHint')} />
        </ToggleRow>
      </SettingsSection>
      <McpSettingsSection />
      <AiProviderSettingsSection />
      <SettingsSection>
        <ToggleRow>
          <Switch
            checked={hardwareAcceleration}
            onChange={(e) => setHardwareAcceleration(e.target.checked)}
            slotProps={{ input: { 'aria-label': t('settings.hardwareAcceleration'), 'data-testid': 'settings-hardware-acceleration' } }}
          />
          <SettingLabel text={t('settings.hardwareAcceleration')} hint={t('settings.hardwareAccelerationHint')} />
        </ToggleRow>
      </SettingsSection>
      {hardwareAcceleration && (
        <ModeSettingsSection>
          <SettingLabel text={t('settings.hwaccelMode')} hint={t('settings.hwaccelModeHint')} />
          <ModeSelect
            select
            size="small"
            data-testid="settings-hwaccel-mode"
            slotProps={{ htmlInput: { 'aria-label': t('settings.hwaccelMode') } }}
            value={hwaccelMode}
            onChange={(e) => setHwaccelMode(e.target.value as HwAccelMode)}
          >
            {HWACCEL_MODES.map((m) => (
              <MenuItem key={m} value={m}>
                {t(hwaccelModeLabel[m])}
              </MenuItem>
            ))}
          </ModeSelect>
        </ModeSettingsSection>
      )}
      {hardwareAcceleration && (
        <ModeSettingsSection>
          <SettingLabel text={t('settings.encoderType')} hint={t('settings.encoderTypeHint')} />
          <ModeSelect
            select
            size="small"
            data-testid="settings-encoder-type"
            slotProps={{ htmlInput: { 'aria-label': t('settings.encoderType') } }}
            value={encoderType}
            onChange={(e) => {
              setEncoderType(e.target.value as EncoderType);
              recordAnalyticsEvent(createAnalyticsEvent('encoder_type_changed', { encoderType: e.target.value as EncoderType }));
            }}
          >
            {ENCODER_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {t(encoderTypeLabel[type])}
              </MenuItem>
            ))}
          </ModeSelect>
        </ModeSettingsSection>
      )}
    </SettingsRoot>
  );
}
