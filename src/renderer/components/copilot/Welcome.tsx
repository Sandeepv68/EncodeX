/**
 * @fileoverview Empty-state welcome for the Copilot conversation.
 */

import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { WelcomeRoot } from '../../styles/copilot/Welcome.styles';

/**
 * Renders the welcome hero shown before the first message.
 * @returns {JSX.Element} The welcome state.
 */
export default function Welcome() {
  const { t } = useTranslation();

  return (
    <WelcomeRoot>
      <Typography variant="h5" component="h2" sx={{ marginBottom: 1 }}>
        {t('copilot.welcome')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480 }}>
        {t('copilot.goal')}
      </Typography>
    </WelcomeRoot>
  );
}
