/**
 * @fileoverview Convert view: the conversion setup form.
 *
 * The view is pre-filled from a model proposal (the `confirmation` payload) and
 * only starts the conversion when the user clicks **Start conversion**, which
 * replays the settings into the app-only `commit_operation` tool. It then
 * tracks the resulting job.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox, FormControlLabel, Typography } from '@mui/material';
import { basename, clampPercent } from '../format';
import { useMcpView, useMcpViewData } from '../McpViewProvider';
import { useMcpViewPolling } from '../useMcpViewPolling';
import { useArmedAction } from '../kit/useArmedAction';
import ViewBadge from '../kit/ViewBadge';
import ViewButton from '../kit/ViewButton';
import ViewCard from '../kit/ViewCard';
import ViewDefinitionList from '../kit/ViewDefinitionList';
import ViewField from '../kit/ViewField';
import ViewProgress from '../kit/ViewProgress';
import { ViewFieldGrid, ViewParagraph, ViewStack } from '../kit/styles';
import type { McpUiConfirmation, McpUiJob } from '../../../shared/mcp-ui';

interface ConvertPayload {
  confirmation?: McpUiConfirmation;
  job?: McpUiJob;
}

/** The editable settings of the conversion form. */
interface ConvertForm {
  input: string;
  output: string;
  videoCodec: string;
  audioCodec: string;
  videoBitrate: string;
  audioBitrate: string;
  qscale: string;
  scale: string;
  copy: boolean;
}

const EMPTY_FORM: ConvertForm = {
  input: '',
  output: '',
  videoCodec: '',
  audioCodec: '',
  videoBitrate: '',
  audioBitrate: '',
  qscale: '',
  scale: '',
  copy: false,
};

/**
 * Renders the convert view.
 * @returns {JSX.Element} The view.
 */
export default function ConvertView() {
  const { t } = useTranslation();
  const { callTool, host } = useMcpView();
  const payload = useMcpViewData<ConvertPayload>();
  const confirmation = payload?.confirmation;
  const job = payload?.job;
  const [form, setForm] = useState<ConvertForm>(EMPTY_FORM);
  const [trackedJobId, setTrackedJobId] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!confirmation) return;
    const args = (confirmation.args ?? {}) as Record<string, unknown>;
    setForm({
      input: String(args.input ?? ''),
      output: String(args.output ?? ''),
      videoCodec: String(args.videoCodec ?? ''),
      audioCodec: String(args.audioCodec ?? ''),
      videoBitrate: String(args.videoBitrate ?? ''),
      audioBitrate: String(args.audioBitrate ?? ''),
      qscale: args.qscale === undefined ? '' : String(args.qscale),
      scale: String(args.scale ?? ''),
      copy: args.copy === true,
    });
  }, [confirmation]);

  useEffect(() => {
    if (job?.id && job.id !== trackedJobId) setTrackedJobId(job.id);
  }, [job?.id, trackedJobId]);

  useMcpViewPolling({
    tool: 'get_job',
    args: trackedJobId ? { jobId: trackedJobId } : undefined,
    intervalMs: 2000,
    enabled: Boolean(trackedJobId) && host.context.supportsServerTools !== false,
  });

  const update = (key: keyof ConvertForm) => (value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));

  const armedCancel = useArmedAction(async () => {
    if (job?.id) await callTool('cancel_job', { jobId: job.id });
  });

  const start = async () => {
    setMessage(undefined);
    if (!form.input) {
      setMessage(t('mcpViews.convert.inputRequired'));
      return;
    }
    const args: Record<string, unknown> = {};
    if (form.input) args.input = form.input;
    if (form.output) args.output = form.output;
    if (form.videoCodec) args.videoCodec = form.videoCodec;
    if (form.audioCodec) args.audioCodec = form.audioCodec;
    if (form.videoBitrate) args.videoBitrate = form.videoBitrate;
    if (form.audioBitrate) args.audioBitrate = form.audioBitrate;
    if (form.scale) args.scale = form.scale;
    if (form.qscale !== '') args.qscale = Number(form.qscale);
    if (form.copy) args.copy = true;
    try {
      const result = await callTool('commit_operation', { tool: 'convert_media', args });
      if (!result.structuredContent?.job) {
        setMessage(t('mcpViews.convert.noJob'));
      }
    } catch (err) {
      setMessage(t('mcpViews.convert.failed', { message: err instanceof Error ? err.message : String(err) }));
    }
  };

  if (job) {
    const percent = clampPercent(job.progress);
    const title = basename(job.output || job.input || job.id);
    const finished = job.status === 'done' || job.status === 'error';
    return (
      <ViewCard
        title={title}
        actions={
          <ViewBadge tone={job.status === 'error' ? 'danger' : finished ? 'ok' : 'info'}>
            {t('mcpViews.common.progressWithStatus', { status: job.status, percent })}
          </ViewBadge>
        }
        testId="mcp-view-convert"
      >
        <ViewStack>
          <ViewProgress percent={percent} label={title} />
          <ViewDefinitionList
            rows={[
              { label: t('mcpViews.common.input'), value: job.input ?? '' },
              { label: t('mcpViews.common.output'), value: job.output ?? '' },
            ]}
          />
          {!finished && (
            <ViewButton
              label={t('mcpViews.common.cancel')}
              confirmLabel={t('mcpViews.common.confirmCancel')}
              armed={armedCancel.armed}
              disabled={armedCancel.busy}
              onClick={armedCancel.trigger}
              testId="mcp-view-convert-cancel"
            />
          )}
        </ViewStack>
      </ViewCard>
    );
  }

  return (
    <ViewCard title={t('mcpViews.convert.title')} testId="mcp-view-convert">
      <ViewStack>
        {confirmation && <ViewParagraph>{t('mcpViews.convert.proposal', { summary: confirmation.summary })}</ViewParagraph>}
        <ViewFieldGrid>
          <ViewField
            label={t('mcpViews.convert.inputLabel')}
            value={form.input}
            onChange={update('input')}
            testId="mcp-view-convert-input"
          />
          <ViewField label={t('mcpViews.convert.outputLabel')} value={form.output} onChange={update('output')} />
          <ViewField label={t('mcpViews.convert.videoCodecLabel')} value={form.videoCodec} onChange={update('videoCodec')} />
          <ViewField label={t('mcpViews.convert.audioCodecLabel')} value={form.audioCodec} onChange={update('audioCodec')} />
          <ViewField label={t('mcpViews.convert.videoBitrateLabel')} value={form.videoBitrate} onChange={update('videoBitrate')} />
          <ViewField label={t('mcpViews.convert.audioBitrateLabel')} value={form.audioBitrate} onChange={update('audioBitrate')} />
          <ViewField label={t('mcpViews.convert.qualityLabel')} value={form.qscale} onChange={update('qscale')} type="number" />
          <ViewField label={t('mcpViews.convert.scaleLabel')} value={form.scale} onChange={update('scale')} />
        </ViewFieldGrid>
        <FormControlLabel
          control={<Checkbox checked={form.copy} onChange={(event) => update('copy')(event.target.checked)} />}
          label={t('mcpViews.convert.lossless')}
        />
        <ViewButton label={t('mcpViews.convert.submit')} variant="primary" onClick={() => void start()} testId="mcp-view-convert-submit" />
        {message && (
          <Typography variant="body2" color="error">
            {message}
          </Typography>
        )}
      </ViewStack>
    </ViewCard>
  );
}
