/**
 * @fileoverview Empty-state welcome for the Copilot conversation.
 */

import { Typography, useTheme } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { WelcomeBadge, WelcomeRoot } from '../../styles/copilot/Welcome.styles';

/**
 * Renders the welcome hero shown before the first message.
 * @returns {JSX.Element} The welcome state.
 */
export default function Welcome() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <WelcomeRoot>
      <WelcomeBadge>
        <FontAwesomeIcon icon={faRobot} size="xl" color={theme.palette.primary.main} aria-hidden />
      </WelcomeBadge>
      <Typography variant="h5" component="h2" sx={{ marginBottom: 1 }}>
        {t('copilot.welcome')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480 }}>
        {t('copilot.goal')}
      </Typography>
    </WelcomeRoot>
  );
}
