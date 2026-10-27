/**
 * @fileoverview Plan view: a recommended conversion plan and its size estimate.
 *
 * The same view serves `recommend_settings` (a plan) and `estimate_conversion`
 * (an estimate), so it renders whichever payload arrives.
 */

import { useTranslation } from 'react-i18next';
import { Typography } from '@mui/material';
import { formatDuration, formatSize, humanizeKey } from '../format';
import { useMcpViewData } from '../McpViewProvider';
import ViewBadge from '../kit/ViewBadge';
import ViewCard from '../kit/ViewCard';
import ViewDefinitionList from '../kit/ViewDefinitionList';
import ViewEmptyState from '../kit/ViewEmptyState';
import ViewFactsList from '../kit/ViewFactsList';
import { ViewBulletList, ViewDotList, ViewSectionTitle, ViewStack } from '../kit/styles';
import type { McpUiEstimate, McpUiPlan } from '../../../shared/mcp-ui';

interface PlanPayload {
  plan?: McpUiPlan;
  estimate?: McpUiEstimate;
}

/**
 * Renders the plan view.
 * @returns {JSX.Element} The view.
 */
export default function PlanView() {
  const { t } = useTranslation();
  const payload = useMcpViewData<PlanPayload>();
  const plan = payload?.plan ?? (payload && 'providerId' in payload ? (payload as unknown as McpUiPlan) : undefined);
  const estimate =
    payload?.estimate ??
    (payload && 'method' in payload && (payload as unknown as McpUiEstimate).method === 'bitrate'
      ? (payload as unknown as McpUiEstimate)
      : undefined);

  if (!plan && !estimate) {
    return (
      <ViewCard testId="mcp-view-plan">
        <ViewEmptyState message={t('mcpViews.plan.waiting')} testId="mcp-view-plan-empty" />
      </ViewCard>
    );
  }

  return (
    <ViewStack>
      {plan && <PlanCard plan={plan} />}
      {estimate && <EstimateCard estimate={estimate} />}
    </ViewStack>
  );
}

interface PlanCardProps {
  plan: McpUiPlan;
}

/**
 * Renders the recommended-settings card.
 * @param {PlanCardProps} props - Component props.
 * @returns {JSX.Element} The card.
 */
function PlanCard({ plan }: PlanCardProps) {
  const { t } = useTranslation();
  const confidence = typeof plan.confidence === 'number' ? Math.round(Math.min(1, Math.max(0, plan.confidence)) * 100) : undefined;
  const rationale = plan.rationale ?? [];
  const args = plan.args ?? {};
  return (
    <ViewCard
      title={plan.profileId || t('mcpViews.plan.planTitle')}
      actions={
        confidence === undefined ? undefined : <ViewBadge tone="info">{t('mcpViews.common.confidence', { value: confidence })}</ViewBadge>
      }
      testId="mcp-view-plan-card"
    >
      <ViewStack>
        {rationale.length > 0 && (
          <>
            <ViewSectionTitle variant="caption">{t('mcpViews.common.rationale')}</ViewSectionTitle>
            <ViewBulletList as="ul">
              {rationale.map((reason) => (
                <li key={reason}>
                  <Typography variant="body2">{reason}</Typography>
                </li>
              ))}
            </ViewBulletList>
          </>
        )}
        {Object.keys(args).length > 0 && (
          <>
            <ViewSectionTitle variant="caption">{t('mcpViews.common.settings')}</ViewSectionTitle>
            <ViewDefinitionList rows={Object.entries(args).map(([key, value]) => ({ label: humanizeKey(key), value: String(value) }))} />
          </>
        )}
      </ViewStack>
    </ViewCard>
  );
}

interface EstimateCardProps {
  estimate: McpUiEstimate;
}

/**
 * Renders the size-estimate card.
 * @param {EstimateCardProps} props - Component props.
 * @returns {JSX.Element} The card.
 */
function EstimateCard({ estimate }: EstimateCardProps) {
  const { t } = useTranslation();
  const hardware = estimate.hardwareAcceleration;
  const hardwareText = hardware?.available
    ? hardware.methods && hardware.methods.length > 0
      ? hardware.methods.join(', ')
      : t('mcpViews.plan.hardwareAvailable')
    : t('mcpViews.plan.hardwareSoftware');
  const notes = estimate.notes ?? [];
  return (
    <ViewCard
      title={t('mcpViews.plan.estimateTitle')}
      actions={<ViewBadge tone="neutral">{t('mcpViews.plan.estimated')}</ViewBadge>}
      testId="mcp-view-plan-estimate"
    >
      <ViewStack>
        <ViewFactsList
          facts={[
            { label: t('mcpViews.common.output'), value: formatSize(estimate.estimatedSizeBytes) },
            { label: t('mcpViews.common.duration'), value: formatDuration(estimate.estimatedDurationSeconds) },
            {
              label: t('mcpViews.common.video'),
              value: estimate.copy ? t('mcpViews.plan.copy') : `${estimate.videoBitrateKbps ?? 0} kbps`,
            },
            {
              label: t('mcpViews.common.audio'),
              value: estimate.copy ? t('mcpViews.plan.copy') : `${estimate.audioBitrateKbps ?? 0} kbps`,
            },
            { label: t('mcpViews.plan.hardware'), value: hardwareText },
          ]}
        />
        {notes.length > 0 && (
          <>
            <ViewSectionTitle variant="caption">{t('mcpViews.common.assumptions')}</ViewSectionTitle>
            <ViewDotList as="ul">
              {notes.map((note) => (
                <li key={note}>
                  <Typography variant="body2">{note}</Typography>
                </li>
              ))}
            </ViewDotList>
          </>
        )}
      </ViewStack>
    </ViewCard>
  );
}
