import { useTranslation } from 'react-i18next';
import { Switch, MenuItem } from '@mui/material';
import { useColorMode } from '../ColorModeContext';
import { useSettingsStore } from '../stores/settingsStore';
import InfoTooltip from '../components/InfoTooltip';
import { HWACCEL_MODES, ENCODER_TYPES } from '../../shared/hwaccel-settings';
import { THEMES } from '../colors';
import type { ThemeId } from '../types';
import type { HwAccelMode, EncoderType } from '../../shared/types';
import {
  SettingsRoot,
  SettingsHeader,
  SettingsTitle,
  SettingsSection,
  SettingsLabel,
  SettingsLabelRow,
  ModeSelect,
} from '../styles/Settings.styles';
import { TitleIcon } from '../styles/PageContainer.styles';
import { pageIcons } from '../pageIcons';

const hwaccelModeLabel: Record<HwAccelMode, string> = {
  auto: 'settings.hwaccelModeAuto',
  encode: 'settings.hwaccelModeEncode',
};

const encoderTypeLabel: Record<EncoderType, string> = {
  auto: 'settings.encoderTypeAuto',
  hardware: 'settings.encoderTypeHardware',
  software: 'settings.encoderTypeSoftware',
};

function SettingLabel({ text, hint }: { text: string; hint: string }) {
  return (
    <SettingsLabelRow>
      <SettingsLabel variant="body1">{text}</SettingsLabel>
      <InfoTooltip title={hint} />
    </SettingsLabelRow>
  );
}

export default function Settings() {
  const { t } = useTranslation();
  const { themeId, setTheme } = useColorMode();
  const hardwareAcceleration = useSettingsStore((s) => s.hardwareAcceleration);
  const hwaccelMode = useSettingsStore((s) => s.hwaccelMode);
  const encoderType = useSettingsStore((s) => s.encoderType);
  const alwaysOnTop = useSettingsStore((s) => s.alwaysOnTop);
  const setHardwareAcceleration = useSettingsStore((s) => s.setHardwareAcceleration);
  const setHwaccelMode = useSettingsStore((s) => s.setHwaccelMode);
  const setEncoderType = useSettingsStore((s) => s.setEncoderType);
  const setAlwaysOnTop = useSettingsStore((s) => s.setAlwaysOnTop);

  return (
    <SettingsRoot>
      <SettingsHeader>
        <SettingsTitle variant="h5">
          <TitleIcon>{pageIcons['/settings']}</TitleIcon>
          {t('settings.title')}
        </SettingsTitle>
      </SettingsHeader>
      <SettingsSection>
        <SettingsLabel variant="body1">{t('settings.theme')}</SettingsLabel>
        <ModeSelect select size="small" value={themeId} onChange={(e) => setTheme(e.target.value as ThemeId)}>
          {THEMES.map((theme) => (
            <MenuItem key={theme.id} value={theme.id}>
              {t(theme.labelKey)}
            </MenuItem>
          ))}
        </ModeSelect>
      </SettingsSection>
      <SettingsSection>
        <SettingLabel text={t('settings.alwaysOnTop')} hint={t('settings.alwaysOnTopHint')} />
        <Switch
          checked={alwaysOnTop}
          onChange={(e) => setAlwaysOnTop(e.target.checked)}
          slotProps={{ input: { 'aria-label': t('settings.alwaysOnTop') } }}
        />
      </SettingsSection>
      <SettingsSection>
        <SettingLabel text={t('settings.hardwareAcceleration')} hint={t('settings.hardwareAccelerationHint')} />
        <Switch
          checked={hardwareAcceleration}
          onChange={(e) => setHardwareAcceleration(e.target.checked)}
          slotProps={{ input: { 'aria-label': t('settings.hardwareAcceleration') } }}
        />
      </SettingsSection>
      {hardwareAcceleration && (
        <SettingsSection>
          <SettingLabel text={t('settings.hwaccelMode')} hint={t('settings.hwaccelModeHint')} />
          <ModeSelect select size="small" value={hwaccelMode} onChange={(e) => setHwaccelMode(e.target.value as HwAccelMode)}>
            {HWACCEL_MODES.map((m) => (
              <MenuItem key={m} value={m}>
                {t(hwaccelModeLabel[m])}
              </MenuItem>
            ))}
          </ModeSelect>
        </SettingsSection>
      )}
      {hardwareAcceleration && (
        <SettingsSection>
          <SettingLabel text={t('settings.encoderType')} hint={t('settings.encoderTypeHint')} />
          <ModeSelect select size="small" value={encoderType} onChange={(e) => setEncoderType(e.target.value as EncoderType)}>
            {ENCODER_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {t(encoderTypeLabel[type])}
              </MenuItem>
            ))}
          </ModeSelect>
        </SettingsSection>
      )}
    </SettingsRoot>
  );
}
