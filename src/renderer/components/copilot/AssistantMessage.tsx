/**
 * @fileoverview Assistant message rendering plan details in conversation.
 */

import { Alert, Box, Button, Chip, List, ListItem, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faListCheck, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import type { CopilotAction, CopilotPlan, CopilotResult } from '../../../shared/copilot';
import type { AgentSkip } from '../../../shared/ai/agent';
import type { AIProviderId } from '../../../shared/ai/types';
import { useTranslation } from 'react-i18next';
import { AssistantBody } from '../../styles/copilot/AssistantMessage.styles';
import { SHADOWS } from '../../colors';
import ProviderIcon from './ProviderIcon';

export interface AssistantMessageProps {
  plan: CopilotPlan | null;
  onAddToQueue: () => void;
  busy?: boolean;
  error?: string | null;
  notice?: string | null;
  /** The currently connected provider; its logo marks each action. */
  providerId?: AIProviderId | null;
}

export default function AssistantMessage({
  plan,
  onAddToQueue,
  busy = false,
  error = null,
  notice = null,
  providerId = null,
}: AssistantMessageProps) {
  const { t } = useTranslation();

  if (error) {
    return (
      <Alert
        severity="error"
        variant="outlined"
        sx={{
          boxShadow: (theme) => (theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT),
          '& .MuiAlert-message': { width: '100%', fontWeight: 600 },
        }}
      >
        😅 {error}
      </Alert>
    );
  }

  if (notice) {
    return (
      <Alert
        severity="info"
        variant="outlined"
        sx={{
          boxShadow: (theme) => (theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT),
          '& .MuiAlert-message': { width: '100%', fontWeight: 600 },
        }}
      >
        ✨ {notice}
      </Alert>
    );
  }

  if (!plan) return null;

  return (
    <AssistantBody data-testid="copilot-plan-summary">
      {plan.operation && (
        <Chip
          size="small"
          label={`✨ ${t('copilot.routedAs', { operation: t(`copilot.op.${plan.operation}`) })}`}
          sx={{ mb: 1 }}
          data-testid="copilot-routed-as"
        />
      )}
      {plan.routingWarning && (
        <Alert
          severity="warning"
          sx={{
            mb: 2,
            boxShadow: (theme) => (theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT),
            '& .MuiAlert-message': { width: '100%', fontWeight: 600 },
          }}
          data-testid="copilot-routing-warning"
        >
          {plan.routingWarning}
        </Alert>
      )}
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        {t('copilot.actionsTitle')}
      </Typography>
      {plan.actions.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          😌 {t('copilot.noActions')}
        </Typography>
      ) : (
        <List dense disablePadding>
          {plan.actions.map((action: CopilotAction) => (
            <ListItem key={action.id} divider sx={{ px: 0 }} data-testid={`copilot-action-${action.id}`}>
              <ListItemIcon sx={{ minWidth: 44 }}>
                <ProviderIcon providerId={providerId} size={32} />
              </ListItemIcon>
              <ListItemText
                primary={action.input}
                secondary={
                  <>
                    <Typography component="span" variant="body2" color="text.secondary">
                      {t('copilot.savings', { pct: Math.round(action.estimatedSavings * 100) })}
                    </Typography>
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      {t('copilot.output', { output: action.output ?? '' })}
                    </Typography>
                  </>
                }
              />
            </ListItem>
          ))}
        </List>
      )}

      {plan.results.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            🎯 {t('copilot.resultsTitle')}
          </Typography>
          <List dense disablePadding>
            {plan.results.map((result: CopilotResult, index: number) => (
              <ListItem key={`${result.input}-${index}`} sx={{ px: 0 }} data-testid="copilot-result">
                <ListItemText primary={result.input} secondary={result.summary ?? result.title ?? ''} />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {plan.skips.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            ⏭️ {t('copilot.skipsTitle')}
          </Typography>
          <List dense disablePadding>
            {plan.skips.map((skip: AgentSkip) => (
              <ListItem key={skip.input} sx={{ px: 0 }} data-testid="copilot-skip">
                <ListItemText primary={skip.input} secondary={skip.reason} />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {plan.rationale.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            💡 {t('copilot.rationaleTitle')}
          </Typography>
          <List dense disablePadding>
            {plan.rationale.map((line: string) => (
              <ListItem key={line} disableGutters sx={{ px: 0 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <FontAwesomeIcon icon={faWandMagicSparkles} />
                </ListItemIcon>
                <ListItemText primary={line} />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {plan.actions.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<FontAwesomeIcon icon={faListCheck} />}
            onClick={onAddToQueue}
            disabled={busy}
            data-testid="copilot-add-to-queue"
          >
            🚀 {t('copilot.addToQueue', { count: plan.actions.length })}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {t('copilot.applyNote')}
          </Typography>
        </Box>
      )}
    </AssistantBody>
  );
}
