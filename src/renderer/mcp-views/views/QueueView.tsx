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
import { useQueueStore } from '../../stores/queueStore';
import ViewBadge from '../kit/ViewBadge';
import ViewButton from '../kit/ViewButton';
import ViewCard from '../kit/ViewCard';
import ViewEmptyState from '../kit/ViewEmptyState';
import ViewProgress from '../kit/ViewProgress';
import { ViewRow, ViewRowFooter, ViewStack } from '../kit/styles';
import type { QueueEntry, QueuePayload, QueueRowProps } from './types';

/**
 * Renders the queue view.
 * @returns {JSX.Element} The view.
 */
export default function QueueView() {
  const { t } = useTranslation();
  const { callTool, host } = useMcpView();
  const payload = useMcpViewData<QueuePayload>();
  const hostJobs = payload?.jobs ?? [];
  // The in-app queue store mirrors the main-process queue, so a job that is
  // already queued shows up in the transcript even when the MCP host has not
  // pushed a payload for it.
  const storeJobs = useQueueStore((state) => state.jobs);
  // Each row remembers where its job came from: the rows of the app's Batch
  // Queue are cancelled through the app's queue bridge, the rows the host
  // pushed are cancelled through the host's `cancel_job` tool.
  const entries: QueueEntry[] =
    hostJobs.length > 0
      ? hostJobs.map((job) => ({ job, fromAppQueue: false }))
      : storeJobs.map((job) => ({
          job: {
            id: job.id,
            input: job.input,
            output: job.output,
            status: job.status,
            progress: job.progress,
            ...(job.error ? { error: job.error } : {}),
          },
          fromAppQueue: true,
        }));
  const jobs = entries.map((entry) => entry.job);

  useMcpViewPolling({
    tool: 'list_jobs',
    intervalMs: 2500,
    enabled: host.context.supportsServerTools !== false,
  });

  const cancelJob = useCallback(
    async (jobId: string, fromAppQueue: boolean) => {
      // The MCP `cancel_job` tool addresses the MCP server's own job manager,
      // which does not know the ids of the app's Batch Queue. Calling it for
      // such a job failed with "Job not found" and the button looked inert, so
      // those jobs are cancelled through the app's queue bridge instead.
      if (fromAppQueue && window.electronAPI?.queueRemove) {
        await window.electronAPI.queueRemove(jobId);
        return;
      }
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
          {entries.map((entry) => (
            <QueueRow key={entry.job.id} job={entry.job} onCancel={() => cancelJob(entry.job.id, entry.fromAppQueue)} />
          ))}
        </ViewStack>
      )}
    </ViewCard>
  );
}

/**
 * Maps a job status to the batch-queue filter key that carries its translated
 * label.
 * @param {string} status - The raw job status.
 * @returns {string} The `batchQueue.filters` key for that status.
 */
function statusFilterKey(status: string): string {
  switch (status) {
    case 'running':
      return 'running';
    case 'done':
      return 'done';
    case 'error':
      return 'failed';
    default:
      return 'queued';
  }
}

/**
 * Renders one job row.
 * @param {QueueRowProps} props - Component props.
 * @returns {JSX.Element} The row.
 */
function QueueRow({ job, onCancel }: QueueRowProps) {
  const { t } = useTranslation();
  const percent = clampPercent(job.progress);
  const armed = useArmedAction(() => onCancel());
  const name = basename(job.output || job.input || job.id);
  const status = t(`batchQueue.filters.${statusFilterKey(job.status)}`);
  return (
    <ViewRow>
      <Typography variant="body2" noWrap title={job.output || job.input || job.id}>
        {name}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t('mcpViews.common.progressWithStatus', { status, percent })}
      </Typography>
      <ViewButton
        label={t('mcpViews.common.cancel')}
        confirmLabel={t('mcpViews.common.confirmCancel')}
        armed={armed.armed}
        disabled={armed.busy}
        onClick={armed.trigger}
        testId={`mcp-view-queue-cancel-${job.id}`}
      />
      {armed.error && (
        <Typography variant="caption" color="error" data-testid={`mcp-view-queue-cancel-error-${job.id}`}>
          {armed.error}
        </Typography>
      )}
      <ViewRowFooter>
        <ViewProgress percent={percent} label={name} />
      </ViewRowFooter>
    </ViewRow>
  );
}
