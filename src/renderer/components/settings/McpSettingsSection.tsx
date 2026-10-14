/**
 * @fileoverview Embedded MCP server settings section for the Settings page.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Switch, IconButton, Tooltip, InputAdornment, Link } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faEye, faEyeSlash, faTrashCan, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import { useSettingsStore } from '../../stores/settingsStore';
import { useToastStore } from '../../stores/toastStore';
import { MCP_MIN_PORT, MCP_MAX_PORT, MCP_DEFAULT_PORT, clampMcpPort } from '../../../shared/mcp-settings';
import { recordAnalyticsEvent } from '../../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../../shared/analytics/events';
import { generateMcpToken } from '../../utils/security-utils';
import { SettingsSection, ModeSettingsSection, McpField, McpValueRow } from '../../styles/Settings.styles';
import { ToggleRow } from '../../styles/form.styles';
import SettingLabel from './SettingLabel';

/**
 * Website URL of the AI use-case documentation, linked from the MCP server
 * settings once the embedded server is enabled.
 * @const {string} MCP_AI_USE_CASES_URL
 */
const MCP_AI_USE_CASES_URL = 'https://encodex.in/features#let-an-ai-assistant-drive';

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
export default function McpSettingsSection() {
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
