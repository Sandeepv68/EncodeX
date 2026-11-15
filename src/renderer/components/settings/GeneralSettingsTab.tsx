/**
 * @fileoverview General tab of the Settings page.
 *
 * Holds the everyday appearance and app-behavior controls: the theme picker,
 * always-on-top, launch-at-login, and desktop notifications.
 */

import { useTranslation } from 'react-i18next';
import { Switch } from '@mui/material';
import { useSettingsStore } from '../../stores/settingsStore';
import { recordAnalyticsEvent } from '../../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../../shared/analytics/events';
import { SettingsSection } from '../../styles/Settings.styles';
import { ToggleRow } from '../../styles/form.styles';
import ThemeSettingsSection from './ThemeSettingsSection';
import SettingLabel from './SettingLabel';

/**
 * Renders the General settings tab.
 *
 * Every value is bound to `useSettingsStore`; the two behavior switches record
 * their existing analytics events unchanged.
 * @returns {JSX.Element} The General tab content.
 */
export default function GeneralSettingsTab() {
  const { t } = useTranslation();
  const alwaysOnTop = useSettingsStore((s) => s.alwaysOnTop);
  const launchAtLogin = useSettingsStore((s) => s.launchAtLogin);
  const desktopNotificationsEnabled = useSettingsStore((s) => s.desktopNotificationsEnabled);
  const setAlwaysOnTop = useSettingsStore((s) => s.setAlwaysOnTop);
  const setLaunchAtLogin = useSettingsStore((s) => s.setLaunchAtLogin);
  const setDesktopNotificationsEnabled = useSettingsStore((s) => s.setDesktopNotificationsEnabled);

  return (
    <>
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
            checked={desktopNotificationsEnabled}
            onChange={(e) => setDesktopNotificationsEnabled(e.target.checked)}
            slotProps={{
              input: { 'aria-label': t('settings.desktopNotifications'), 'data-testid': 'settings-desktop-notifications' },
            }}
          />
          <SettingLabel text={t('settings.desktopNotifications')} hint={t('settings.desktopNotificationsHint')} />
        </ToggleRow>
      </SettingsSection>
    </>
  );
}
