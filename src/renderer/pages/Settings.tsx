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
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Switch, MenuItem, IconButton, Tooltip, InputAdornment } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faEye, faEyeSlash, faTrashCan, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { useColorMode } from '../ColorModeContext';
import { useSettingsStore } from '../stores/settingsStore';
import { useToastStore } from '../stores/toastStore';
import InfoTooltip from '../components/InfoTooltip';
import { HWACCEL_MODES, ENCODER_TYPES } from '../../shared/hwaccel-settings';
import { MCP_MIN_PORT, MCP_MAX_PORT } from '../../shared/mcp-settings';
import { THEMES } from '../colors';
import type { ThemeDefinition } from '../colors';
import type { HwAccelMode, EncoderType } from '../../shared/types';
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

/**
 * Maps each encoder type value to the translation key of its label, read under
 * the `settings.` namespace.
 * @const {Record<EncoderType, string>}
 */
const encoderTypeLabel: Record<EncoderType, string> = {
  auto: 'settings.encoderTypeAuto',
  hardware: 'settings.encoderTypeHardware',
  software: 'settings.encoderTypeSoftware',
};

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
 * Generates a cryptographically random, URL-safe bearer token from 32 random
 * bytes (base64url-encoded, padding stripped).
 * @returns {string} A 43-character secure token.
 */
function generateMcpToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
    if (Number.isInteger(parsed)) setMcpPort(parsed);
    else setPortText(String(port));
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
  };

  const hasToken = token.length > 0;
  const endpoint = `http://127.0.0.1:${port}/mcp`;
  const authorization = `Bearer ${token}`;

  /**
   * Copies a connection detail value to the clipboard and confirms with a toast.
   * @param {string} value - The value to copy.
   * @returns {Promise<void>} Resolves once the value is copied (or fails).
   */
  const copyConnectionValue = async (value: string): Promise<void> => {
    await navigator.clipboard.writeText(value);
    useToastStore.getState().success(t('settings.mcpCopied'));
  };

  return (
    <>
      <SettingsSection>
        <ToggleRow>
          <Switch
            checked={enabled}
            onChange={(e) => setMcpEnabled(e.target.checked)}
            slotProps={{ input: { 'aria-label': t('settings.mcpServer'), 'data-testid': 'settings-mcp-server' } }}
          />
          <SettingLabel text={t('settings.mcpServer')} hint={t('settings.mcpServerHint')} />
        </ToggleRow>
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
            <Box sx={(theme) => (hasToken ? undefined : { marginLeft: 'auto' })}>
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
                <CopyButton value={token} label={t('settings.mcpCopy')} testId="settings-mcp-token-copy" onCopy={copyConnectionValue} />
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
            <CopyButton value={endpoint} label={t('settings.mcpCopy')} testId="settings-mcp-copy-endpoint" onCopy={copyConnectionValue} />
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
            <CopyButton value={authorization} label={t('settings.mcpCopy')} testId="settings-mcp-copy-token" onCopy={copyConnectionValue} />
          </McpValueRow>
        </ModeSettingsSection>
      )}
    </>
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
 * No IPC calls are made directly from this page.
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
  const setMonitoringEnabled = useSettingsStore((s) => s.setMonitoringEnabled);

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
            onChange={(e) => setAlwaysOnTop(e.target.checked)}
            slotProps={{ input: { 'aria-label': t('settings.alwaysOnTop'), 'data-testid': 'settings-always-on-top' } }}
          />
          <SettingLabel text={t('settings.alwaysOnTop')} hint={t('settings.alwaysOnTopHint')} />
        </ToggleRow>
      </SettingsSection>
      <SettingsSection>
        <ToggleRow>
          <Switch
            checked={launchAtLogin}
            onChange={(e) => setLaunchAtLogin(e.target.checked)}
            slotProps={{ input: { 'aria-label': t('settings.launchAtLogin'), 'data-testid': 'settings-launch-at-login' } }}
          />
          <SettingLabel text={t('settings.launchAtLogin')} hint={t('settings.launchAtLoginHint')} />
        </ToggleRow>
      </SettingsSection>
      <SettingsSection>
        <ToggleRow>
          <Switch
            checked={monitoringEnabled}
            onChange={(e) => setMonitoringEnabled(e.target.checked)}
            slotProps={{
              input: { 'aria-label': t('settings.monitoringErrorReporting'), 'data-testid': 'settings-monitoring-error-reporting' },
            }}
          />
          <SettingLabel text={t('settings.monitoringErrorReporting')} hint={t('settings.monitoringErrorReportingHint')} />
        </ToggleRow>
      </SettingsSection>
      <McpSettingsSection />
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
            onChange={(e) => setEncoderType(e.target.value as EncoderType)}
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
