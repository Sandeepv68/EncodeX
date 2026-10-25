/**
 * @fileoverview Shared AI connection status pill: the provider logo badge, a
 * green/muted status dot, and a caption that expands on hover. Used by the
 * Copilot composer and the Settings AI-provider header so both show the same
 * connection status.
 */

import { Box, useTheme } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRobot } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import { aiProviderLogo } from '../utils/ai-provider-icons';
import type { AIProviderId } from '../../shared/ai/types';
import { ConnectionDot, ConnectionStatus, RightActions } from '../styles/copilot/ChatComposer.styles';
import { SHADOWS } from '../colors';

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
export default function AiConnectionStatus({ connected, providerId, model, testId, expanded = false, elevated = false }: AiConnectionStatusProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const logo = providerId ? aiProviderLogo(providerId, theme.palette.mode) : null;

  return (
    <RightActions
      data-testid={testId}
      sx={elevated ? { boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT } : undefined}
    >
      <ConnectionStatus $connected={connected}>
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: theme.typography.pxToRem(22),
            height: theme.typography.pxToRem(22),
            borderRadius: '50%',
            bgcolor: 'background.paper',
            border: `${theme.typography.pxToRem(1)} solid`,
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          {logo ? (
            <Box component="img" src={logo} alt="" sx={{ width: theme.typography.pxToRem(14), height: theme.typography.pxToRem(14) }} />
          ) : (
            <Box component="span" sx={{ display: 'inline-flex', fontSize: theme.typography.pxToRem(12) }}>
              <FontAwesomeIcon icon={faRobot} />
            </Box>
          )}
          <ConnectionDot
            $connected={connected}
            aria-hidden="true"
            sx={{ position: 'absolute', bottom: theme.typography.pxToRem(-1), right: theme.typography.pxToRem(-1) }}
          />
        </Box>
        <Box
          className="copilot-ai-status-text"
          sx={{
            maxWidth: expanded ? theme.typography.pxToRem(420) : 0,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            opacity: expanded ? 1 : 0,
            marginInlineStart: expanded ? theme.spacing(0.75) : 0,
            transition: theme.transitions.create(['max-width', 'opacity'], {
              duration: theme.transitions.duration.short,
            }),
          }}
        >
          {connected
            ? t('settings.ai.headerConnected', {
                provider: t(`settings.ai.providers.${providerId}`),
                model: model || t('settings.ai.modelPlaceholder'),
              })
            : t('copilot.ai.notConnected')}
        </Box>
      </ConnectionStatus>
    </RightActions>
  );
}
