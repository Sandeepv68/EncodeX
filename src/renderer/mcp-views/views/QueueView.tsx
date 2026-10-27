/**
 * @fileoverview Queue view: a live dashboard of the conversion queue.
 *
 * The view polls `list_jobs` and lets the user cancel a job. Cancelling is
 * armed: the first click only arms the button so a stray click cannot kill a
 * running conversion.
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@mui/material';
import { basename, clampPercent } from '../format';
import { useMcpView, useMcpViewData } from '../McpViewProvider';
import { useMcpViewPolling } from '../useMcpViewPolling';
import { useArmedAction } from '../kit/useArmedAction';
import ViewBadge from '../kit/ViewBadge';
import ViewButton from '../kit/ViewButton';
import ViewCard from '../kit/ViewCard';
import ViewEmptyState from '../kit/ViewEmptyState';
import ViewProgress from '../kit/ViewProgress';
import { ViewRow, ViewRowFooter, ViewStack } from '../kit/styles';
import type { McpUiJob } from '../../../shared/mcp-ui';

interface QueuePayload {
  jobs?: McpUiJob[];
}

/**
 * Renders the queue view.
 * @returns {JSX.Element} The view.
 */
export default function QueueView() {
  const { t } = useTranslation();
  const { callTool, host } = useMcpView();
  const payload = useMcpViewData<QueuePayload>();
  const jobs = payload?.jobs ?? [];

  useMcpViewPolling({
    tool: 'list_jobs',
    intervalMs: 2500,
    enabled: host.context.supportsServerTools !== false,
  });

  const cancelJob = useCallback(
    async (jobId: string) => {
      await callTool('cancel_job', { jobId });
    },
    [callTool],
  );

  return (
    <ViewCard
      title={t('mcpViews.queue.title')}
      actions={
        jobs.length > 0 ? (
          <ViewBadge tone="info">
            {jobs.length === 1
              ? t('mcpViews.common.jobCountOne', { count: jobs.length })
              : t('mcpViews.common.jobCount', { count: jobs.length })}
          </ViewBadge>
        ) : undefined
      }
      testId="mcp-view-queue"
    >
      {jobs.length === 0 ? (
        <ViewEmptyState message={t('mcpViews.queue.empty')} testId="mcp-view-queue-empty" />
      ) : (
        <ViewStack>
          {jobs.map((job) => (
            <QueueRow key={job.id} job={job} onCancel={cancelJob} />
          ))}
        </ViewStack>
      )}
    </ViewCard>
  );
}

interface QueueRowProps {
  job: McpUiJob;
  onCancel: (jobId: string) => Promise<void>;
}

/**
 * Renders one job row.
 * @param {QueueRowProps} props - Component props.
 * @returns {JSX.Element} The row.
 */
function QueueRow({ job, onCancel }: QueueRowProps) {
  const { t } = useTranslation();
  const percent = clampPercent(job.progress);
  const armed = useArmedAction(() => onCancel(job.id));
  const name = basename(job.output || job.input || job.id);
  return (
    <ViewRow>
      <Typography variant="body2" noWrap title={job.output || job.input || job.id}>
        {name}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t('mcpViews.common.progressWithStatus', { status: job.status, percent })}
      </Typography>
      <ViewButton
        label={t('mcpViews.common.cancel')}
        confirmLabel={t('mcpViews.common.confirmCancel')}
        armed={armed.armed}
        disabled={armed.busy}
        onClick={armed.trigger}
        testId={`mcp-view-queue-cancel-${job.id}`}
      />
      <ViewRowFooter>
        <ViewProgress percent={percent} label={name} />
      </ViewRowFooter>
    </ViewRow>
  );
}
