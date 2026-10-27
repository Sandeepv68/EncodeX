/**
 * @fileoverview Job view: the state of a single conversion job.
 *
 * The view learns its job id from the first payload the host delivers and
 * then polls `get_job` for that id, so the same view works for a job the host
 * selects and for a job the user picked.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@mui/material';
import { basename, clampPercent } from '../format';
import { useMcpView, useMcpViewData } from '../McpViewProvider';
import { useMcpViewPolling } from '../useMcpViewPolling';
import { useArmedAction } from '../kit/useArmedAction';
import ViewBadge from '../kit/ViewBadge';
import ViewButton from '../kit/ViewButton';
import ViewCard from '../kit/ViewCard';
import ViewDefinitionList from '../kit/ViewDefinitionList';
import ViewEmptyState from '../kit/ViewEmptyState';
import ViewProgress from '../kit/ViewProgress';
import { ViewStack } from '../kit/styles';
import type { McpUiJob } from '../../../shared/mcp-ui';

interface JobPayload {
  job?: McpUiJob;
}

/**
 * Renders the job view.
 * @returns {JSX.Element} The view.
 */
export default function JobView() {
  const { t } = useTranslation();
  const { callTool, host } = useMcpView();
  const payload = useMcpViewData<JobPayload>();
  const job = payload?.job;
  const [jobId, setJobId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (job?.id && job.id !== jobId) setJobId(job.id);
  }, [job?.id, jobId]);

  useMcpViewPolling({
    tool: 'get_job',
    args: jobId ? { jobId } : undefined,
    intervalMs: 2000,
    enabled: Boolean(jobId) && host.context.supportsServerTools !== false,
  });

  if (!job) {
    return (
      <ViewCard testId="mcp-view-job">
        <ViewEmptyState message={t('mcpViews.job.waiting')} testId="mcp-view-job-empty" />
      </ViewCard>
    );
  }

  const percent = clampPercent(job.progress);
  const finished = job.status === 'done' || job.status === 'error';
  const title = basename(job.output || job.input || job.id);

  return (
    <ViewCard
      title={title}
      actions={
        <ViewBadge tone={job.status === 'error' ? 'danger' : finished ? 'ok' : 'info'}>
          {t('mcpViews.common.progressWithStatus', { status: job.status, percent })}
        </ViewBadge>
      }
      testId="mcp-view-job"
    >
      <ViewStack>
        <ViewProgress percent={percent} label={title} />
        <ViewDefinitionList
          rows={[
            { label: t('mcpViews.common.input'), value: job.input ?? '' },
            { label: t('mcpViews.common.output'), value: job.output ?? '' },
          ]}
        />
        {job.error && (
          <Typography variant="body2" color="error">
            {job.error}
          </Typography>
        )}
        {!finished && (
          <JobCancelButton
            jobId={job.id}
            onCancel={async (id) => {
              await callTool('cancel_job', { jobId: id });
            }}
          />
        )}
      </ViewStack>
    </ViewCard>
  );
}

interface JobCancelButtonProps {
  jobId: string;
  onCancel: (jobId: string) => Promise<void>;
}

/**
 * Renders the armed cancel action of the job view.
 * @param {JobCancelButtonProps} props - Component props.
 * @returns {JSX.Element} The button.
 */
function JobCancelButton({ jobId, onCancel }: JobCancelButtonProps) {
  const { t } = useTranslation();
  const armed = useArmedAction(() => onCancel(jobId));
  return (
    <ViewButton
      label={t('mcpViews.common.cancel')}
      confirmLabel={t('mcpViews.common.confirmCancel')}
      armed={armed.armed}
      disabled={armed.busy}
      onClick={armed.trigger}
      testId="mcp-view-job-cancel"
    />
  );
}
