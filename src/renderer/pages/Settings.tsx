/**
 * @fileoverview Settings page. Configures the app-wide appearance, conversion
 * defaults, and AI surfaces. Corresponds to the `/settings` route and is
 * reached from the navigation bar.
 *
 * The page is a thin shell that owns the tab state and the AI deep link. The
 * actual settings live in the tab components under `components/settings/`:
 * `GeneralSettingsTab` (theme and everyday behavior), `AdvancedSettingsTab`
 * (hardware acceleration and diagnostics), and `AiSettingsTab` (AI provider and
 * MCP server). Every persisted value lives in the `useSettingsStore` zustand
 * store, which synchronizes it to disk and to the main process; this page only
 * reads and writes store state and makes no direct IPC calls.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tab } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrochip, faSliders } from '@fortawesome/free-solid-svg-icons';
import { useLocation } from 'react-router-dom';
import { recordAnalyticsEvent } from '../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../shared/analytics/events';
import type { SettingsLocationState, SettingsTab } from '../types';
import EncodexLogoIcon from '../components/EncodexLogoIcon';
import GeneralSettingsTab from '../components/settings/GeneralSettingsTab';
import AdvancedSettingsTab from '../components/settings/AdvancedSettingsTab';
import AiSettingsTab from '../components/settings/AiSettingsTab';
import { SettingsRoot, SettingsHeader, SettingsTitle, SettingsTabs, SettingsTabLabel, SettingsTabPanel } from '../styles/Settings.styles';
import { TitleIcon } from '../styles/PageContainer.styles';
import { pageIcons } from '../pageIcons';

/**
 * Renders the settings page (`/settings`).
 *
 * Layout: a header followed by three tabs. `general` is the default; a caller
 * that navigates with `{ openAiProvider: true }` lands on the `ai` tab with the
 * provider editor open. Panels stay mounted so drafts and the editor's open
 * state survive tab switches; `hidden` keeps inactive panels out of the
 * accessibility tree and the tab order.
 *
 * @returns {JSX.Element} The page content.
 */
export default function Settings() {
  const { t } = useTranslation();
  const location = useLocation();
  const state = location.state as SettingsLocationState | null;
  const wantsAi = state?.openAiProvider === true;
  const [tab, setTab] = useState<SettingsTab>(wantsAi ? 'ai' : 'general');
  const [aiReveal, setAiReveal] = useState(wantsAi);

  useEffect(() => {
    // Only the arrival of the location applies the request. The effect used to
    // run on every location change, which threw away a tab the user had
    // picked by hand whenever the same state was still in play.
    if (!wantsAi) return;
    setTab('ai');
    setAiReveal(true);
  }, [location.key]);

  const handleTabChange = (next: SettingsTab): void => {
    // MUI only raises `onChange` when a *different* tab is selected, so this
    // handler only ever runs for a real change of tab.
    setTab(next);
    recordAnalyticsEvent(createAnalyticsEvent('settings_tab_viewed', { tab: next }));
  };

  return (
    <SettingsRoot>
      <SettingsHeader>
        <SettingsTitle variant="h5" component="h1">
          <TitleIcon>{pageIcons['/settings']}</TitleIcon>
          {t('settings.title')}
        </SettingsTitle>
      </SettingsHeader>
      <SettingsTabs
        value={tab}
        onChange={(_event, next: SettingsTab) => handleTabChange(next)}
        aria-label={t('settings.tabs.ariaLabel')}
        textColor="inherit"
        data-testid="settings-tabs"
      >
        <Tab
          value="general"
          label={
            <SettingsTabLabel>
              <FontAwesomeIcon icon={faSliders} />
              {t('settings.tabs.general')}
            </SettingsTabLabel>
          }
          id="settings-tab-general"
          aria-controls="settings-tabpanel-general"
          data-testid="settings-tab-general"
        />
        <Tab
          value="advanced"
          label={
            <SettingsTabLabel>
              <FontAwesomeIcon icon={faMicrochip} />
              {t('settings.tabs.advanced')}
            </SettingsTabLabel>
          }
          id="settings-tab-advanced"
          aria-controls="settings-tabpanel-advanced"
          data-testid="settings-tab-advanced"
        />
        <Tab
          value="ai"
          label={
            <SettingsTabLabel>
              <EncodexLogoIcon />
              {t('settings.tabs.ai')}
            </SettingsTabLabel>
          }
          id="settings-tab-ai"
          aria-controls="settings-tabpanel-ai"
          data-testid="settings-tab-ai"
        />
      </SettingsTabs>
      <SettingsTabPanel
        role="tabpanel"
        hidden={tab !== 'general'}
        id="settings-tabpanel-general"
        aria-labelledby="settings-tab-general"
        data-testid="settings-tabpanel-general"
        tabIndex={0}
      >
        <GeneralSettingsTab />
      </SettingsTabPanel>
      <SettingsTabPanel
        role="tabpanel"
        hidden={tab !== 'advanced'}
        id="settings-tabpanel-advanced"
        aria-labelledby="settings-tab-advanced"
        data-testid="settings-tabpanel-advanced"
        tabIndex={0}
      >
        <AdvancedSettingsTab />
      </SettingsTabPanel>
      <SettingsTabPanel
        role="tabpanel"
        hidden={tab !== 'ai'}
        id="settings-tabpanel-ai"
        aria-labelledby="settings-tab-ai"
        data-testid="settings-tabpanel-ai"
        tabIndex={0}
      >
        <AiSettingsTab autoOpen={aiReveal} />
      </SettingsTabPanel>
    </SettingsRoot>
  );
}
