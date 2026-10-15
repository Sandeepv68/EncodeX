/**
 * @fileoverview Theme picker section for the Settings page.
 *
 * Renders one preview card per entry in `THEMES`; selecting a card persists the
 * theme through `useColorMode`.
 */

import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useColorMode } from '../../ColorModeContext';
import { THEMES } from '../../colors';
import type { ThemeDefinition } from '../../colors';
import { SettingsLabel } from '../../styles/Settings.styles';
import {
  ThemeSettingsSection as ThemeSettingsSectionRoot,
  ThemeSwitcher,
  ThemeCard,
  ThemePreview,
  ThemePreviewPaper,
  ThemePreviewTextBar,
  ThemePreviewAccentBar,
} from '../../styles/settings/ThemeSettingsSection.styles';

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
 * Renders the theme section: a preview card per available theme.
 * @returns {JSX.Element} The theme picker rows.
 */
export default function ThemeSettingsSection() {
  const { t } = useTranslation();
  const { themeId, setTheme } = useColorMode();

  return (
    <ThemeSettingsSectionRoot>
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
    </ThemeSettingsSectionRoot>
  );
}
