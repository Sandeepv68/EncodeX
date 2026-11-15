/**
 * @fileoverview Advanced tab of the Settings page.
 *
 * Holds hardware acceleration (with its conditional mode and encoder selects)
 * and the usage data / error reporting switch.
 */

import { useTranslation } from 'react-i18next';
import { MenuItem, Switch } from '@mui/material';
import { useSettingsStore } from '../../stores/settingsStore';
import { HWACCEL_MODES, ENCODER_TYPES } from '../../../shared/hwaccel-settings';
import { recordAnalyticsEvent } from '../../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../../shared/analytics/events';
import type { HwAccelMode, EncoderType } from '../../../shared/types';
import { SettingsSection, ModeSettingsSection, ModeSelect } from '../../styles/Settings.styles';
import { ToggleRow } from '../../styles/form.styles';
import { encoderTypeLabel } from '../../utils/encoding-option-utils';
import SettingLabel from './SettingLabel';

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
 * Renders the Advanced settings tab.
 *
 * The mode and encoder selects appear only while hardware acceleration is
 * enabled, matching the previous page behavior. The usage-data switch stays
 * bound to `monitoringEnabled` / `setTelemetryEnabled`.
 * @returns {JSX.Element} The Advanced tab content.
 */
export default function AdvancedSettingsTab() {
  const { t } = useTranslation();
  const hardwareAcceleration = useSettingsStore((s) => s.hardwareAcceleration);
  const hwaccelMode = useSettingsStore((s) => s.hwaccelMode);
  const encoderType = useSettingsStore((s) => s.encoderType);
  const monitoringEnabled = useSettingsStore((s) => s.monitoringEnabled);
  const setHardwareAcceleration = useSettingsStore((s) => s.setHardwareAcceleration);
  const setHwaccelMode = useSettingsStore((s) => s.setHwaccelMode);
  const setEncoderType = useSettingsStore((s) => s.setEncoderType);
  const setTelemetryEnabled = useSettingsStore((s) => s.setTelemetryEnabled);

  return (
    <>
      <SettingsSection>
        <ToggleRow>
          <Switch
            checked={hardwareAcceleration}
            onChange={(e) => setHardwareAcceleration(e.target.checked)}
            slotProps={{
              input: { 'aria-label': t('settings.hardwareAcceleration'), 'data-testid': 'settings-hardware-acceleration' },
            }}
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
    </>
  );
}
