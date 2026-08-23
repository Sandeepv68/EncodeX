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

import { useTranslation } from 'react-i18next';
import { Box, Switch, MenuItem } from '@mui/material';
import { useColorMode } from '../ColorModeContext';
import { useSettingsStore } from '../stores/settingsStore';
import InfoTooltip from '../components/InfoTooltip';
import { HWACCEL_MODES, ENCODER_TYPES } from '../../shared/hwaccel-settings';
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
    <ThemePreview style={{ backgroundColor: theme.background.default }}>
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
 * Renders the settings page (`/settings`).
 *
 * Layout: a theme section whose cards call `setTheme` from `useColorMode`, and
 * `SettingsSection`s for the "always on top" and "launch at startup" switches,
 * the hardware-acceleration enable switch, and (only when acceleration is
 * enabled) the hwaccel-mode and encoder-type selects. All values are bound
 * one-way to `useSettingsStore`; store setters update persisted state and the
 * main process automatically.
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
