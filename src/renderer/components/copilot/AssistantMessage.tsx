/**
 * @fileoverview Assistant message rendering plan details in conversation.
 */

import { Button, List, ListItemText, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faListCheck, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons';
import type { CopilotAction, CopilotPlan, CopilotResult } from '../../../shared/copilot';
import type { AgentSkip } from '../../../shared/ai/agent';
import type { AIProviderId } from '../../../shared/ai/types';
import { useTranslation } from 'react-i18next';
import {
  ActionListItemIcon,
  ApplyNoteText,
  AssistantAlert,
  AssistantBody,
  AssistantWarningAlert,
  McpViewBlock,
  PlanListItem,
  RationaleListItemIcon,
  RoutedChip,
  SavingsText,
  SectionBlock,
  SectionHeading,
} from '../../styles/copilot/AssistantMessage.styles';
import ProviderIcon from './ProviderIcon';
import McpAppView from './McpAppView';

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
      <AssistantAlert severity="error" variant="outlined">
        😅 {error}
      </AssistantAlert>
    );
  }

  if (notice) {
    return (
      <AssistantAlert severity="info" variant="outlined">
        ✨ {notice}
      </AssistantAlert>
    );
  }

  if (!plan) return null;

  return (
    <AssistantBody data-testid="copilot-plan-summary">
      {plan.operation && (
        <RoutedChip
          size="small"
          label={`✨ ${t('copilot.routedAs', { operation: t(`copilot.op.${plan.operation}`) })}`}
          data-testid="copilot-routed-as"
        />
      )}
      {plan.routingWarning && (
        <AssistantWarningAlert severity="warning" data-testid="copilot-routing-warning">
          {plan.routingWarning}
        </AssistantWarningAlert>
      )}
      <SectionHeading variant="subtitle1" component="h2">
        {t('copilot.actionsTitle')}
      </SectionHeading>
      {plan.actions.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          😌 {t('copilot.noActions')}
        </Typography>
      ) : (
        <List dense disablePadding>
          {plan.actions.map((action: CopilotAction) => (
            <PlanListItem key={action.id} divider data-testid={`copilot-action-${action.id}`}>
              <ActionListItemIcon>
                <ProviderIcon providerId={providerId} size={32} />
              </ActionListItemIcon>
              <ListItemText
                primary={action.input}
                secondary={
                  <>
                    <Typography component="span" variant="body2" color="text.secondary">
                      {t('copilot.savings', { pct: Math.round(action.estimatedSavings * 100) })}
                    </Typography>
                    <SavingsText component="span" variant="body2" color="text.secondary">
                      {t('copilot.output', { output: action.output ?? '' })}
                    </SavingsText>
                  </>
                }
              />
            </PlanListItem>
          ))}
        </List>
      )}

      {plan.results.length > 0 && (
        <SectionBlock>
          <SectionHeading variant="subtitle1" component="h2">
            🎯 {t('copilot.resultsTitle')}
          </SectionHeading>
          <List dense disablePadding>
            {plan.results.map((result: CopilotResult, index: number) => (
              <PlanListItem key={`${result.input}-${index}`} data-testid="copilot-result">
                <ListItemText primary={result.input} secondary={result.summary ?? result.title ?? ''} />
              </PlanListItem>
            ))}
          </List>
        </SectionBlock>
      )}

      {plan.skips.length > 0 && (
        <SectionBlock>
          <SectionHeading variant="subtitle1" component="h2">
            ⏭️ {t('copilot.skipsTitle')}
          </SectionHeading>
          <List dense disablePadding>
            {plan.skips.map((skip: AgentSkip) => (
              <PlanListItem key={skip.input} data-testid="copilot-skip">
                <ListItemText primary={skip.input} secondary={skip.reason} />
              </PlanListItem>
            ))}
          </List>
        </SectionBlock>
      )}

      {plan.rationale.length > 0 && (
        <SectionBlock>
          <SectionHeading variant="subtitle1" component="h2">
            💡 {t('copilot.rationaleTitle')}
          </SectionHeading>
          <List dense disablePadding>
            {plan.rationale.map((line: string) => (
              <PlanListItem key={line} disableGutters>
                <RationaleListItemIcon>
                  <FontAwesomeIcon icon={faWandMagicSparkles} />
                </RationaleListItemIcon>
                <ListItemText primary={line} />
              </PlanListItem>
            ))}
          </List>
        </SectionBlock>
      )}

      {plan.views && plan.views.length > 0 && (
        <SectionBlock data-testid="copilot-mcp-views">
          {plan.views.map((view, index) => (
            <McpViewBlock key={`${view.viewId}:${index}`} $last={index === plan.views!.length - 1}>
              <McpAppView attachment={view} />
            </McpViewBlock>
          ))}
        </SectionBlock>
      )}

      {plan.actions.length > 0 && (
        <SectionBlock>
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
          <ApplyNoteText variant="caption" color="text.secondary">
            {t('copilot.applyNote')}
          </ApplyNoteText>
        </SectionBlock>
      )}
    </AssistantBody>
  );
}
