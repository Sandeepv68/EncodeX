/**
 * @fileoverview Batch view: the batch confirmation and its live dashboard.
 *
 * The batch is proposed first and only runs when the user approves it; the
 * dashboard that follows polls `list_jobs` for every file of the batch.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@mui/material';
import { basename, clampPercent } from '../format';
import { useMcpView, useMcpViewData } from '../McpViewProvider';
import { resultErrorText } from '../host';
import { useMcpViewPolling } from '../useMcpViewPolling';
import ViewBadge from '../kit/ViewBadge';
import ViewButton from '../kit/ViewButton';
import ViewCard from '../kit/ViewCard';
import ViewDefinitionList from '../kit/ViewDefinitionList';
import ViewEmptyState from '../kit/ViewEmptyState';
import ViewProgress from '../kit/ViewProgress';
import { ViewBulletList, ViewParagraph, ViewRow, ViewRowFooter, ViewStack } from '../kit/styles';
import type { McpUiConfirmation } from '../../../shared/mcp-ui';
import type { BatchPayload, BatchRowProps } from './types';

/**
 * Renders the batch view.
 * @returns {JSX.Element} The view.
 */
export default function BatchView() {
  const { t } = useTranslation();
  const { callTool, host } = useMcpView();
  const payload = useMcpViewData<BatchPayload>();
  // The proposal is latched: the commit answers with the jobs it queued, and
  // that payload must not wipe the card the user approved.
  const [proposal, setProposal] = useState<McpUiConfirmation | undefined>(payload?.confirmation);
  const jobs = payload?.jobs ?? [];
  const confirmation = jobs.length > 0 ? undefined : proposal;
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (payload?.confirmation) setProposal(payload.confirmation);
  }, [payload?.confirmation]);

  useMcpViewPolling({
    tool: 'list_jobs',
    intervalMs: 2500,
    enabled: !confirmation && host.context.supportsServerTools !== false,
  });

  /**
   * Commits the confirmed batch.
   * @returns {Promise<void>} Resolves once the batch was requested.
   */
  async function runBatch(): Promise<void> {
    if (!confirmation) return;
    setRunning(true);
    setMessage(undefined);
    try {
      const result = await callTool('commit_operation', { tool: confirmation.operation, args: confirmation.args });
      const failure = resultErrorText(result);
      if (failure) {
        setMessage(failure);
        return;
      }
      if (result.structuredContent?.confirmation) {
        setMessage(t('mcpViews.batch.needsReapproval'));
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  if (confirmation) {
    return (
      <ViewCard title={confirmation.title || t('mcpViews.batch.title')} testId="mcp-view-batch">
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
          <ViewButton
            label={t('mcpViews.batch.run')}
            variant="primary"
            disabled={running}
            onClick={() => void runBatch()}
            testId="mcp-view-batch-run"
          />
          {message && (
            <Typography variant="body2" color="error">
              {message}
            </Typography>
          )}
        </ViewStack>
      </ViewCard>
    );
  }

  return (
    <ViewCard
      title={t('mcpViews.batch.dashboard')}
      actions={
        <ViewBadge tone="info">
          {jobs.length === 1
            ? t('mcpViews.common.fileCountOne', { count: jobs.length })
            : t('mcpViews.common.fileCount', { count: jobs.length })}
        </ViewBadge>
      }
      testId="mcp-view-batch-dashboard"
    >
      {jobs.length === 0 ? (
        <ViewEmptyState message={t('mcpViews.batch.waiting')} testId="mcp-view-batch-empty" />
      ) : (
        <ViewStack>
          {jobs.map((entry, index) => (
            <BatchRow key={entry.id ?? entry.jobId ?? index} entry={entry} />
          ))}
        </ViewStack>
      )}
    </ViewCard>
  );
}

/**
 * Renders one file of the batch dashboard.
 * @param {BatchRowProps} props - Component props.
 * @returns {JSX.Element} The row.
 */
function BatchRow({ entry }: BatchRowProps) {
  const { t } = useTranslation();
  const percent = clampPercent(entry.progress);
  const name = basename(entry.output || entry.file || entry.input || entry.jobId || entry.id || '');
  const status = entry.status ?? 'queued';
  return (
    <ViewRow>
      <Typography variant="body2" noWrap title={name}>
        {name}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {t('mcpViews.common.progressWithStatus', { status, percent })}
      </Typography>
      <ViewRowFooter>
        <ViewProgress percent={percent} label={name} />
      </ViewRowFooter>
    </ViewRow>
  );
}
