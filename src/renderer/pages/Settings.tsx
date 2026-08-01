import { useTranslation } from 'react-i18next';
import { Tooltip } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { useColorMode } from '../ColorModeContext';
import { SettingsRoot, SettingsHeader, SettingsTitle, SettingsSection, SettingsLabel, ThemeToggleButton } from '../styles/Settings.styles';

export default function Settings() {
  const { t } = useTranslation();
  const { mode, toggleColorMode } = useColorMode();

  return (
    <SettingsRoot>
      <SettingsHeader>
        <SettingsTitle variant="h5">{t('settings.title')}</SettingsTitle>
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
    </SettingsRoot>
  );
}
