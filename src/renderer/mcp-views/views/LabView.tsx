/**
 * @fileoverview Lab view: the measured size-target compression result.
 *
 * The server measures every candidate against the requested ceiling; the view
 * shows the ladder, every attempt and the winning fit.
 */

import { useTranslation } from 'react-i18next';
import { Typography } from '@mui/material';
import { formatSize } from '../format';
import { useMcpViewData } from '../McpViewProvider';
import ViewBadge from '../kit/ViewBadge';
import ViewCard from '../kit/ViewCard';
import ViewDefinitionList from '../kit/ViewDefinitionList';
import ViewEmptyState from '../kit/ViewEmptyState';
import ViewTable from '../kit/ViewTable';
import { ViewDotList, ViewSectionTitle, ViewStack } from '../kit/styles';
import type { McpUiLab } from '../../../shared/mcp-ui';
import type { LabPayload } from './types';

/**
 * Renders the lab view.
 * @returns {JSX.Element} The view.
 */
export default function LabView() {
  const { t } = useTranslation();
  const payload = useMcpViewData<LabPayload>();
  const lab = payload?.lab ?? (payload && 'attempts' in payload ? (payload as unknown as McpUiLab) : undefined);

  if (!lab) {
    return (
      <ViewCard testId="mcp-view-lab">
        <ViewEmptyState message={t('mcpViews.lab.waiting')} testId="mcp-view-lab-empty" />
      </ViewCard>
    );
  }

  const attempts = lab.attempts ?? [];
  const chosen = lab.chosen;
  const plan = lab.plan;
  const notes: string[] = [];
  if (plan?.baselineVideoKbps) {
    notes.push(
      t('mcpViews.lab.baseline', {
        video: plan.baselineVideoKbps,
        audio: plan.audioBitrateKbps ?? 0,
      }),
    );
  }
  for (const candidate of plan?.candidates ?? []) {
    notes.push(
      t('mcpViews.lab.candidate', {
        video: candidate.videoBitrateKbps ?? 0,
        percent: candidate.percentOfBaseline ?? 0,
        rationale: candidate.rationale ?? '',
      }),
    );
  }
  for (const note of plan?.notes ?? []) notes.push(note);

  return (
    <ViewStack>
      <ViewCard
        title={t('mcpViews.lab.title')}
        actions={
          <ViewBadge tone={lab.converged ? 'ok' : 'danger'}>{lab.converged ? t('mcpViews.lab.fits') : t('mcpViews.lab.noFit')}</ViewBadge>
        }
        testId="mcp-view-lab-summary"
      >
        <ViewDefinitionList
          rows={[
            { label: t('mcpViews.common.input'), value: lab.input ?? '' },
            { label: t('mcpViews.common.size'), value: formatSize(lab.maxBytes) },
            { label: t('mcpViews.common.video'), value: lab.videoCodec ?? '' },
            { label: t('mcpViews.common.audio'), value: lab.audioCodec ?? '' },
          ]}
        />
      </ViewCard>

      {chosen && (
        <ViewCard
          title={t('mcpViews.lab.chosenTitle')}
          actions={<ViewBadge tone="ok">{t('mcpViews.lab.measured')}</ViewBadge>}
          testId="mcp-view-lab-chosen"
        >
          <ViewDefinitionList
            rows={[
              { label: t('mcpViews.common.video'), value: `${chosen.videoBitrateKbps ?? 0} kbps` },
              { label: t('mcpViews.common.audio'), value: `${chosen.audioBitrateKbps ?? 0} kbps` },
              { label: t('mcpViews.common.size'), value: formatSize(chosen.sizeBytes) },
              { label: t('mcpViews.common.output'), value: chosen.output ?? '' },
            ]}
          />
        </ViewCard>
      )}

      {attempts.length > 0 && (
        <ViewCard title={t('mcpViews.common.attempts')} testId="mcp-view-lab-attempts">
          <ViewTable
            columns={[
              t('mcpViews.lab.columnIndex'),
              t('mcpViews.lab.columnVideo'),
              t('mcpViews.lab.columnOutput'),
              t('mcpViews.lab.columnFits'),
            ]}
            rows={attempts.map((attempt, index) => [
              attempt.candidate || String(index + 1),
              `${attempt.videoBitrateKbps ?? 0} kbps`,
              typeof attempt.sizeBytes === 'number' ? formatSize(attempt.sizeBytes) : (attempt.status ?? ''),
              attempt.fits ? t('mcpViews.lab.yes') : t('mcpViews.lab.no'),
            ])}
          />
        </ViewCard>
      )}

      {notes.length > 0 && (
        <ViewCard title={t('mcpViews.lab.ladder')} testId="mcp-view-lab-ladder">
          <ViewSectionTitle variant="caption">{t('mcpViews.common.notes')}</ViewSectionTitle>
          <ViewDotList as="ul">
            {notes.map((note) => (
              <li key={note}>
                <Typography variant="body2">{note}</Typography>
              </li>
            ))}
          </ViewDotList>
        </ViewCard>
      )}
    </ViewStack>
  );
}
