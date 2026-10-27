/**
 * @fileoverview Confirmation view: the approval card of a proposed operation.
 *
 * The server never runs a mutating tool on an MCP Apps host: it returns a
 * proposal, this view renders it, and only the user's click replays the exact
 * arguments into the app-only `commit_operation` tool.
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
import { ViewBulletList, ViewParagraph, ViewStack } from '../kit/styles';
import type { McpUiConfirmation, McpUiJob } from '../../../shared/mcp-ui';

interface ConfirmPayload {
  confirmation?: McpUiConfirmation;
  job?: McpUiJob;
  jobs?: Array<{ id?: string; output?: string; file?: string; jobId?: string; status?: string }>;
}

/**
 * Renders the confirmation view.
 * @returns {JSX.Element} The view.
 */
export default function ConfirmView() {
  const { t } = useTranslation();
  const { host } = useMcpView();
  const payload = useMcpViewData<ConfirmPayload>();
  const confirmation = payload?.confirmation;
  const [trackedJobId, setTrackedJobId] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    const jobId = payload?.job?.id;
    if (jobId && jobId !== trackedJobId) setTrackedJobId(jobId);
  }, [payload?.job?.id, trackedJobId]);

  useMcpViewPolling({
    tool: 'get_job',
    args: trackedJobId ? { jobId: trackedJobId } : undefined,
    intervalMs: 2000,
    enabled: Boolean(trackedJobId) && host.context.supportsServerTools !== false,
  });

  if (!confirmation && !payload?.job && !payload?.jobs) {
    return (
      <ViewCard testId="mcp-view-confirm">
        <ViewEmptyState message={t('mcpViews.confirm.waiting')} testId="mcp-view-confirm-empty" />
      </ViewCard>
    );
  }

  if (confirmation) {
    return (
      <ViewCard title={confirmation.title || t('mcpViews.confirm.title')} testId="mcp-view-confirm">
        <ViewStack>
          <ViewParagraph>{confirmation.summary}</ViewParagraph>
          {confirmation.details && confirmation.details.length > 0 && (
            <ViewDefinitionList rows={confirmation.details.map((detail) => ({ label: detail.label, value: detail.value }))} />
          )}
          {confirmation.warnings && confirmation.warnings.length > 0 && (
            <ViewBulletList as="ul">
              {confirmation.warnings.map((warning) => (
                <li key={warning}>
                  <Typography variant="body2" color="error">
                    {warning}
                  </Typography>
                </li>
              ))}
            </ViewBulletList>
          )}
          <ConfirmRunButton operation={confirmation.operation} args={confirmation.args} onError={(text) => setMessage(text)} />
          {message && (
            <Typography variant="body2" color="error">
              {message}
            </Typography>
          )}
        </ViewStack>
      </ViewCard>
    );
  }

  if (payload?.job) {
    return <JobProgressCard job={payload.job} />;
  }

  const jobs = payload?.jobs ?? [];
  return (
    <ViewCard
      title={t('mcpViews.confirm.queuedJobs')}
      actions={<ViewBadge tone="info">{t('mcpViews.common.jobCount', { count: jobs.length })}</ViewBadge>}
      testId="mcp-view-confirm"
    >
      <ViewStack>
        {jobs.map((entry, index) => (
          <ViewDefinitionList
            key={`${entry.jobId ?? entry.id ?? index}`}
            rows={[{ label: basename(entry.output || entry.file || entry.jobId || ''), value: entry.status ?? '' }]}
          />
        ))}
      </ViewStack>
    </ViewCard>
  );
}

interface ConfirmRunButtonProps {
  operation: string;
  args: Record<string, unknown>;
  onError: (message: string) => void;
}

/**
 * Renders the button that commits the confirmed operation.
 *
 * The click *is* the approval, so this button is not armed: one click runs
 * the operation the user just reviewed.
 * @param {ConfirmRunButtonProps} props - Component props.
 * @returns {JSX.Element} The button.
 */
function ConfirmRunButton({ operation, args, onError }: ConfirmRunButtonProps) {
  const { t } = useTranslation();
  const { callTool } = useMcpView();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const result = await callTool('commit_operation', { tool: operation, args });
      const structured = result.structuredContent;
      if (!structured || (!structured.job && !structured.jobs)) {
        onError(t('mcpViews.confirm.noJob'));
      }
    } catch (err) {
      onError(t('mcpViews.confirm.failed', { message: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ViewButton
      label={t('mcpViews.confirm.run')}
      variant="primary"
      disabled={busy}
      onClick={() => void run()}
      testId="mcp-view-confirm-run"
    />
  );
}

interface JobProgressCardProps {
  job: McpUiJob;
}

/**
 * Renders the progress card shown after the operation was committed.
 * @param {JobProgressCardProps} props - Component props.
 * @returns {JSX.Element} The card.
 */
function JobProgressCard({ job }: JobProgressCardProps) {
  const { t } = useTranslation();
  const { callTool } = useMcpView();
  const percent = clampPercent(job.progress);
  const finished = job.status === 'done' || job.status === 'error';
  const title = basename(job.output || job.input || job.id);
  const armed = useArmedAction(async () => {
    await callTool('cancel_job', { jobId: job.id });
  });
  return (
    <ViewCard
      title={title}
      actions={
        <ViewBadge tone={job.status === 'error' ? 'danger' : finished ? 'ok' : 'info'}>
          {t('mcpViews.common.progressWithStatus', { status: job.status, percent })}
        </ViewBadge>
      }
      testId="mcp-view-confirm"
    >
      <ViewStack>
        <ViewProgress percent={percent} label={title} />
        <ViewDefinitionList rows={[{ label: t('mcpViews.common.output'), value: job.output ?? '' }]} />
        {!finished && (
          <ViewButton
            label={t('mcpViews.common.cancel')}
            confirmLabel={t('mcpViews.common.confirmCancel')}
            armed={armed.armed}
            disabled={armed.busy}
            onClick={armed.trigger}
            testId="mcp-view-confirm-cancel"
          />
        )}
      </ViewStack>
    </ViewCard>
  );
}
