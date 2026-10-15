/**
 * @fileoverview Settings page. Configures the app-wide appearance and conversion
 * defaults. Corresponds to the `/settings` route and is reached from the
 * navigation bar.
 *
 * The page is a thin shell that lays out the settings sections. The theme
 * picker, the embedded MCP server rows, and the AI-provider editor each live in
 * their own component under `components/settings/`; this file keeps the header,
 * the simple on/off switches, and the hardware-acceleration options. Every
 * persisted value lives in the `useSettingsStore` zustand store, which
 * synchronizes it to disk and to the main process; this page only reads and
 * writes store state and makes no direct IPC calls.
 */

import { useTranslation } from 'react-i18next';
import { Switch, MenuItem } from '@mui/material';
import { useSettingsStore } from '../stores/settingsStore';
import SettingLabel from '../components/settings/SettingLabel';
import ThemeSettingsSection from '../components/settings/ThemeSettingsSection';
import McpSettingsSection from '../components/settings/McpSettingsSection';
import AiProviderSettingsSection from '../components/settings/AiProviderSettingsSection';
import { HWACCEL_MODES, ENCODER_TYPES } from '../../shared/hwaccel-settings';
import { recordAnalyticsEvent } from '../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../shared/analytics/events';
import type { HwAccelMode, EncoderType } from '../../shared/types';
import { SettingsRoot, SettingsHeader, SettingsTitle, SettingsSection, ModeSelect, ModeSettingsSection } from '../styles/Settings.styles';
import { ToggleRow } from '../styles/form.styles';
import { TitleIcon } from '../styles/PageContainer.styles';
import { pageIcons } from '../pageIcons';
import { encoderTypeLabel } from '../utils/encoding-option-utils';

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
 * Renders the settings page (`/settings`).
 *
 * Layout: a theme section whose cards call `setTheme` from `useColorMode`, and
 * `SettingsSection`s for the "always on top" and "launch at startup" switches,
 * the error-reporting switch, the embedded MCP server rows, the AI-provider
 * editor, the hardware-acceleration enable switch, and (only when acceleration
 * is enabled) the hwaccel-mode and encoder-type selects. All values are bound
 * one-way to `useSettingsStore`; store setters update persisted state and the
 * main process automatically.
 *
 * The AI-provider section is the one exception and calls the `ai-*` bridge
 * directly; all other settings are store-backed.
 *
 * @returns {JSX.Element} The page content.
 */
export default function Settings() {
  const { t } = useTranslation();
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
      <ThemeSettingsSection />
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
