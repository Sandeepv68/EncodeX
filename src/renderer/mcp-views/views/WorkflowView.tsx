/**
 * @fileoverview Workflow view: a typed workflow dry-run and its run report.
 *
 * `plan_workflow` delivers the ordered plan (and whether it is valid);
 * `execute_workflow` delivers the per-step outcome. The view renders whichever
 * arrived.
 */

import { useTranslation } from 'react-i18next';
import { Typography } from '@mui/material';
import { useMcpViewData } from '../McpViewProvider';
import ViewBadge from '../kit/ViewBadge';
import ViewCard from '../kit/ViewCard';
import ViewEmptyState from '../kit/ViewEmptyState';
import ViewSteps from '../kit/ViewSteps';
import { ViewBulletList, ViewStack } from '../kit/styles';
import type { McpUiWorkflowPlan, McpUiWorkflowResult } from '../../../shared/mcp-ui';
import type { ResultCardProps, WorkflowPayload, WorkflowPlanCardProps } from './types';

/**
 * Renders the workflow view.
 * @returns {JSX.Element} The view.
 */
export default function WorkflowView() {
  const { t } = useTranslation();
  const payload = useMcpViewData<WorkflowPayload>();
  const plan = payload?.plan ?? (payload && 'valid' in payload ? (payload as unknown as McpUiWorkflowPlan) : undefined);
  const result =
    payload?.result ?? (payload && 'steps' in payload && 'completed' in payload ? (payload as unknown as McpUiWorkflowResult) : undefined);

  if (!plan && !result) {
    return (
      <ViewCard testId="mcp-view-workflow">
        <ViewEmptyState message={t('mcpViews.workflow.waiting')} testId="mcp-view-workflow-empty" />
      </ViewCard>
    );
  }

  return (
    <ViewStack>
      {plan && <WorkflowPlanCard plan={plan} />}
      {result && <ResultCard result={result} />}
    </ViewStack>
  );
}

/**
 * Renders the workflow plan card.
 * @param {WorkflowPlanCardProps} props - Component props.
 * @returns {JSX.Element} The card.
 */
function WorkflowPlanCard({ plan }: WorkflowPlanCardProps) {
  const { t } = useTranslation();
  const steps = plan.steps ?? [];
  const issues = plan.issues ?? [];
  return (
    <ViewCard
      title={plan.summary || t('mcpViews.workflow.planTitle')}
      actions={
        <ViewBadge tone={plan.valid ? 'ok' : 'danger'}>
          {plan.valid ? t('mcpViews.workflow.valid') : t('mcpViews.workflow.invalid')}
        </ViewBadge>
      }
      testId="mcp-view-workflow-plan"
    >
      <ViewStack>
        <ViewSteps
          steps={steps.map((step) => ({
            primary: `${step.tool ?? ''} (${step.id ?? ''})`,
            secondary:
              step.dependsOn && step.dependsOn.length > 0 ? t('mcpViews.workflow.needs', { dependencies: step.dependsOn.join(', ') }) : '',
          }))}
        />
        {issues.length > 0 && (
          <ViewBulletList as="ul">
            {issues.map((issue, index) => (
              <li key={`${issue.message ?? 'issue'}:${index}`}>
                <Typography variant="body2" color="error">
                  {issue.message ?? ''}
                </Typography>
              </li>
            ))}
          </ViewBulletList>
        )}
      </ViewStack>
    </ViewCard>
  );
}

/**
 * Renders the workflow run report card.
 * @param {ResultCardProps} props - Component props.
 * @returns {JSX.Element} The card.
 */
function ResultCard({ result }: ResultCardProps) {
  const { t } = useTranslation();
  const steps = result.steps ?? [];
  return (
    <ViewCard
      title={t('mcpViews.workflow.resultTitle')}
      actions={
        <ViewBadge tone={result.failed ? 'danger' : 'ok'}>
          {result.failed ? t('mcpViews.workflow.failed') : t('mcpViews.workflow.completed')}
        </ViewBadge>
      }
      testId="mcp-view-workflow-result"
    >
      <ViewSteps
        steps={steps.map((step) => ({
          primary: `${step.tool ?? ''} (${step.id ?? ''})`,
          secondary: `${step.status ?? ''}${step.output ? ` ${step.output}` : ''}`,
        }))}
      />
    </ViewCard>
  );
}
