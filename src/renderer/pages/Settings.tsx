import { useTranslation } from 'react-i18next';
import { Tooltip, Switch, TextField, MenuItem } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { useColorMode } from '../ColorModeContext';
import { useSettingsStore } from '../stores/settingsStore';
import InfoTooltip from '../components/InfoTooltip';
import { HWACCEL_MODES, ENCODER_TYPES } from '../../shared/hwaccel-settings';
import type { HwAccelMode, EncoderType } from '../../shared/hwaccel-settings';
import {
  SettingsRoot,
  SettingsHeader,
  SettingsTitle,
  SettingsSection,
  SettingsLabel,
  SettingsLabelRow,
  ThemeToggleButton,
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
  const { mode, toggleColorMode } = useColorMode();
  const hardwareAcceleration = useSettingsStore((s) => s.hardwareAcceleration);
  const hwaccelMode = useSettingsStore((s) => s.hwaccelMode);
  const encoderType = useSettingsStore((s) => s.encoderType);
  const setHardwareAcceleration = useSettingsStore((s) => s.setHardwareAcceleration);
  const setHwaccelMode = useSettingsStore((s) => s.setHwaccelMode);
  const setEncoderType = useSettingsStore((s) => s.setEncoderType);

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
        <Tooltip title={mode === 'dark' ? t('app.switchLight') : t('app.switchDark')}>
          <ThemeToggleButton size="medium" onClick={toggleColorMode}>
            {mode === 'dark' ? (
              <FontAwesomeIcon icon={faSun} style={{ fontSize: 20 }} />
            ) : (
              <FontAwesomeIcon icon={faMoon} style={{ fontSize: 20 }} />
            )}
          </ThemeToggleButton>
        </Tooltip>
      </SettingsSection>
      <SettingsSection>
        <SettingLabel text={t('settings.hardwareAcceleration')} hint={t('settings.hardwareAccelerationHint')} />
        <Switch checked={hardwareAcceleration} onChange={(e) => setHardwareAcceleration(e.target.checked)} />
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
