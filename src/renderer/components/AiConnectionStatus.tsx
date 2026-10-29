/**
 * @fileoverview Shared AI connection status pill: the provider logo badge, a
 * green/muted status dot, and a caption that expands on hover. Used by the
 * Copilot composer and the Settings AI-provider header so both show the same
 * connection status.
 */

import { useTheme } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { aiProviderLogo } from '../utils/ai-provider-icons';
import type { AIProviderId } from '../../shared/ai/types';
import { ConnectionStatus } from '../styles/copilot/ChatComposer.styles';
import {
  ProviderBadge,
  ProviderIconFallback,
  ProviderLogo,
  StatusCaption,
  StatusDot,
  StatusPill,
} from '../styles/AiConnectionStatus.styles';

/** Props for {@link AiConnectionStatus}. */
interface AiConnectionStatusProps {
  connected: boolean;
  providerId?: AIProviderId;
  model?: string;
  /** Test id applied to the pill's outer element. */
  testId?: string;
  /** Show the caption without waiting for hover. */
  expanded?: boolean;
  /** Adds a soft drop shadow to the pill. */
  elevated?: boolean;
}

/**
 * Renders the AI connection status pill.
 * @param {AiConnectionStatusProps} props - Component props.
 * @returns {JSX.Element} The status pill.
 */
export default function AiConnectionStatus({
  connected,
  providerId,
  model,
  testId,
  expanded = false,
  elevated = false,
}: AiConnectionStatusProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const logo = providerId ? aiProviderLogo(providerId, theme.palette.mode) : null;

  return (
    <StatusPill data-testid={testId} $elevated={elevated}>
      <ConnectionStatus $connected={connected}>
        <ProviderBadge>
          {logo ? (
            <ProviderLogo src={logo} alt="" />
          ) : (
            <ProviderIconFallback>
              <FontAwesomeIcon icon={faRobot} />
            </ProviderIconFallback>
          )}
          <StatusDot $connected={connected} aria-hidden="true" />
        </ProviderBadge>
        <StatusCaption className="copilot-ai-status-text" $expanded={expanded}>
          {connected
            ? t('settings.ai.headerConnected', {
                provider: t(`settings.ai.providers.${providerId}`),
                model: model || t('settings.ai.modelPlaceholder'),
              })
            : t('copilot.ai.notConnected')}
        </StatusCaption>
      </ConnectionStatus>
    </StatusPill>
  );
}
