/**
 * @fileoverview Empty-state welcome for the Copilot conversation.
 */

import { useTranslation } from 'react-i18next';
import { WelcomeRoot, WelcomeSubtitle, WelcomeTitle } from '../../styles/copilot/Welcome.styles';

/**
 * Renders the welcome hero shown before the first message.
 * @returns {JSX.Element} The welcome state.
 */
export default function Welcome() {
  const { t } = useTranslation();

  return (
    <WelcomeRoot>
      <WelcomeTitle variant="h5" component="h2">
        {t('copilot.welcome')}
      </WelcomeTitle>
      <WelcomeSubtitle variant="body2" color="text.secondary">
        {t('copilot.goal')}
      </WelcomeSubtitle>
    </WelcomeRoot>
  );
}
