/**
 * @fileoverview Single job card in the mux queue list.
 *
 * Renders one remux or demux job as an outlined card: a lazy preview thumbnail
 * of the input file (video frame or image preview, sharing the batch queue's
 * session cache), a kind chip (Remux / Demux), the input filename, the queue
 * status as a colored chip, an in-card progress bar while running, the error
 * text for failed jobs, and a summary of the job's outputs - the single output
 * file for a remux, or the number of extracted streams and the output folder
 * for a demux.
 *
 * The card can be expanded to list the job's full details: the input path, the
 * output file (remux) or output folder (demux), every extracted stream with its
 * own conversion settings (demux), the transcoder, the error text of a failed
 * job, and the creation timestamp. Per-job actions are remove,
 * reveal-in-folder, and copy-path.
 *
 * The default export wires the card into @dnd-kit's sortable context so QUEUED
 * jobs can be reordered by dragging the grip handle; running and finished jobs
 * are not draggable.
 */

import { useState } from 'react';
import { Collapse, IconButton, TableBody, TableHead, TableRow, Tooltip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  faTrashCan,
  faRotateRight,
  faFolderOpen,
  faCopy,
  faGripVertical,
  faChevronUp,
  faChevronDown,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ErrorBoundary } from './ErrorBoundary';
import EllipsisTooltip from './EllipsisTooltip';
import ProgressBar from './ProgressBar';
import { useLazyThumbnail } from '../hooks/useLazyThumbnail';
import { basename } from '../utils/path-utils';
import { statusChipColor } from '../utils/queue-job-utils';
import { useToastStore } from '../stores/toastStore';
import { QUEUE_STATUS } from '../../shared/media-options';
import type { ConversionOptions } from '../../shared/types';
import type { MuxQueueJobCardProps } from './types';
import {
  JobCard,
  CardBody,
  CardContent,
  CardHeaderRow,
  JobNameText,
  JobTitleWrapper,
  ThumbWrap,
  ThumbImg,
  StatusChip,
  CardActionsStack,
  DragHandleButton,
  DetailsBox,
  DetailsTable,
  DetailsSubTable,
  DetailsCellHost,
  FLUSH_CELL_CLASS,
  DetailsCellLabel,
  DetailsCellValue,
  DetailsSectionCell,
  DetailsHeaderCell,
  DetailsStreamCell,
  DetailsOutputCell,
  DetailsPath,
} from '../styles/QueueJobCard.styles';

/**
 * Renders a single mux queue job card as a dnd-kit sortable item.
 * @param {MuxQueueJobCardProps} props - Component props.
 * @returns {JSX.Element} The sortable job card.
 */
export default function MuxQueueJobCard({ job, progress, onRemove, onRetry }: MuxQueueJobCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  /**
   * Lazy preview thumbnail of the job's input (shared session cache with the
   * batch queue) and the ref that marks the card as visible.
   * @type {{ thumbnail: string | null; anchorRef: React.RefObject<HTMLDivElement | null> }}
   */
  const { thumbnail, anchorRef } = useLazyThumbnail(job.input);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: job.id,
    disabled: job.status !== QUEUE_STATUS.QUEUED,
  });

  /**
   * Reveals the job's first output in the OS file manager.
   * @returns {Promise<void>} Resolves once the reveal request is issued.
   */
  const handleReveal = async () => {
    const firstOutput = job.targets[0]?.output ?? job.output;
    if (firstOutput) await window.electronAPI.revealFile(firstOutput);
  };

  /**
   * Copies the job's output path to the clipboard and confirms via a toast.
   * @returns {Promise<void>} Resolves once the path is copied.
   */
  const handleCopyPath = async () => {
    const path = job.targets[0]?.output ?? job.output;
    await navigator.clipboard.writeText(path);
    useToastStore.getState().success(t('toast.pathCopied'));
  };

  const detailsLabel = expanded ? t('batchQueue.collapseDetails') : t('batchQueue.expandDetails');
  const kindLabel = job.kind === 'demux' ? t('muxQueue.kindDemux') : t('muxQueue.kindRemux');

  /**
   * The target that produces the job's own output (the remux output file).
   * Its options describe the whole job, so they are shown as the job's own
   * options instead of as a separate output entry.
   * @type {import('../../shared/types').MuxQueueTarget | undefined}
   */
  const primaryTarget = job.targets.find((target) => target.output === job.output);

  /**
   * Targets that write their own file, i.e. the extracted streams of a demux.
   * They carry the per-stream details the job-level output cannot show.
   * @type {import('../../shared/types').MuxQueueTarget[]}
   */
  const streamTargets = job.targets.filter((target) => target.output !== job.output);

  /**
   * Builds the label/value rows summarizing a set of conversion options.
   * Only options that are actually set are listed, so the summary stays short;
   * booleans render as Yes/No.
   * @param {ConversionOptions} options - The options to summarize.
   * @returns {{label: string, value: string}[]} The ordered summary rows.
   */
  const buildOptionRows = (options: ConversionOptions): { label: string; value: string }[] => {
    const rows: { label: string; value: string }[] = [];
    const yes = t('batchQueue.yes');
    const no = t('batchQueue.no');
    if (options.copy !== undefined) rows.push({ label: t('batchQueue.optionCopy'), value: options.copy ? yes : no });
    if (options.videoCodec) rows.push({ label: t('batchQueue.optionVideoCodec'), value: options.videoCodec });
    if (options.audioCodec) rows.push({ label: t('batchQueue.optionAudioCodec'), value: options.audioCodec });
    if (options.subtitleCodec) rows.push({ label: t('mediaInfo.subtitle'), value: options.subtitleCodec });
    if (options.videoBitrate) rows.push({ label: t('batchQueue.optionVideoBitrate'), value: options.videoBitrate });
    if (options.audioBitrate) rows.push({ label: t('batchQueue.optionAudioBitrate'), value: options.audioBitrate });
    if (options.qscale !== undefined) rows.push({ label: t('batchQueue.optionQscale'), value: String(options.qscale) });
    if (options.scale) rows.push({ label: t('batchQueue.optionScale'), value: options.scale });
    if (options.pixelFormat) rows.push({ label: t('batchQueue.optionPixelFormat'), value: options.pixelFormat });
    if (options.startTime || options.endTime) {
      rows.push({ label: t('batchQueue.optionTrim'), value: [options.startTime, options.endTime].filter(Boolean).join(' → ') });
    }
    if (options.duration) rows.push({ label: t('batchQueue.optionDuration'), value: options.duration });
    if (options.hardwareAcceleration !== undefined) {
      rows.push({ label: t('batchQueue.optionHwaccel'), value: options.hardwareAcceleration ? yes : no });
    }
    if (options.hwaccelMode) rows.push({ label: t('batchQueue.optionHwaccelMode'), value: options.hwaccelMode });
    if (options.videoFilters?.length) {
      rows.push({ label: t('remux.filtersTitle'), value: String(options.videoFilters.length) });
    }
    return rows;
  };

  /**
   * The job-level option rows, taken from the target that writes the job's
   * own output. Empty when the job has no such target (a demux).
   * @type {{label: string, value: string}[]}
   */
  const jobOptionRows = primaryTarget ? buildOptionRows(primaryTarget.options) : [];

  /**
   * Short description of the job's output shown on the collapsed card: the
   * output file name for a remux, the number of extracted streams and the
   * output folder for a demux. The full paths live in the details panel.
   * @type {string}
   */
  const summaryText =
    job.kind === 'demux'
      ? `${t('muxQueue.targets', { count: job.targets.length })} · ${t('muxQueue.outputDir')}: ${basename(job.output)}`
      : `${t('batchQueue.detailsOutput')}: ${basename(job.output)}`;

  return (
    <JobCard
      ref={setNodeRef}
      data-testid={`mux-queue-job-card-${job.id}`}
      $status={job.status}
      $transform={CSS.Transform.toString(transform)}
      $dragging={isDragging}
      variant="outlined"
    >
      <CardBody ref={anchorRef}>
        {thumbnail && (
          <ThumbWrap>
            <ThumbImg src={thumbnail} alt="" data-testid="mux-queue-job-thumbnail" />
          </ThumbWrap>
        )}
        <CardContent>
          <CardHeaderRow>
            <JobTitleWrapper>
              <EllipsisTooltip title={job.input}>
                <JobNameText variant="body2">{basename(job.input)}</JobNameText>
              </EllipsisTooltip>
            </JobTitleWrapper>
            <CardActionsStack direction="row" spacing={1}>
              <StatusChip label={kindLabel} color="default" variant="outlined" data-testid="mux-queue-job-kind" />
              <StatusChip label={job.status} color={statusChipColor(job.status)} variant="outlined" />
              {job.status === QUEUE_STATUS.RUNNING && job.paused && (
                <StatusChip label={t('muxQueue.paused')} color="info" variant="outlined" />
              )}
              {job.status === QUEUE_STATUS.QUEUED && (
                <Tooltip title={t('muxQueue.dragHandle')}>
                  <DragHandleButton size="small" aria-label={t('muxQueue.dragHandle')} {...attributes} {...listeners}>
                    <FontAwesomeIcon icon={faGripVertical} />
                  </DragHandleButton>
                </Tooltip>
              )}
              {job.status === QUEUE_STATUS.ERROR && onRetry && (
                <Tooltip title={t('batchQueue.retry')}>
                  <IconButton size="small" aria-label={t('batchQueue.retry')} onClick={() => onRetry(job)}>
                    <FontAwesomeIcon icon={faRotateRight} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={t('batchQueue.revealInFolder')}>
                <IconButton size="small" aria-label={t('batchQueue.revealInFolder')} onClick={handleReveal}>
                  <FontAwesomeIcon icon={faFolderOpen} />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('batchQueue.copyPath')}>
                <IconButton size="small" aria-label={t('batchQueue.copyPath')} onClick={handleCopyPath}>
                  <FontAwesomeIcon icon={faCopy} />
                </IconButton>
              </Tooltip>
              <Tooltip title={detailsLabel}>
                <IconButton size="small" aria-label={detailsLabel} aria-expanded={expanded} onClick={() => setExpanded((prev) => !prev)}>
                  <FontAwesomeIcon icon={expanded ? faChevronUp : faChevronDown} />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('batchQueue.remove')}>
                <IconButton size="small" color="error" aria-label={t('batchQueue.remove')} onClick={() => onRemove(job.id)}>
                  <FontAwesomeIcon icon={faTrashCan} />
                </IconButton>
              </Tooltip>
            </CardActionsStack>
          </CardHeaderRow>
          {job.status === QUEUE_STATUS.RUNNING && (
            <ErrorBoundary fallback={null}>
              <ProgressBar
                percent={job.progress}
                time={progress?.time}
                speed={progress?.speed}
                eta={progress?.eta}
                paused={job.paused}
                shadowed
              />
            </ErrorBoundary>
          )}
          <Typography variant="caption" color="text.secondary" data-testid="mux-queue-job-summary">
            {summaryText}
          </Typography>
          {job.error && !expanded && (
            <Typography variant="caption" color="error" data-testid="mux-queue-job-error">
              {job.error}
            </Typography>
          )}
        </CardContent>
      </CardBody>
      <Collapse in={expanded}>
        <DetailsBox>
          <DetailsTable>
            <TableBody>
              <TableRow>
                <DetailsCellLabel>{t('convert.inputFile')}</DetailsCellLabel>
                <DetailsCellValue>
                  <DetailsPath data-testid="mux-queue-job-input">{job.input}</DetailsPath>
                </DetailsCellValue>
              </TableRow>
              <TableRow>
                <DetailsCellLabel>{job.kind === 'demux' ? t('muxQueue.outputDir') : t('muxQueue.detailsTargets')}</DetailsCellLabel>
                <DetailsCellValue>
                  <DetailsPath data-testid="mux-queue-job-output">{job.output}</DetailsPath>
                </DetailsCellValue>
              </TableRow>
              {job.targets.length === 0 && (
                <TableRow>
                  <DetailsCellLabel>{t('muxQueue.noOutputs')}</DetailsCellLabel>
                  <DetailsCellValue />
                </TableRow>
              )}
              {streamTargets.length > 0 && (
                <>
                  <TableRow>
                    <DetailsSectionCell colSpan={2}>{t('muxQueue.targets', { count: streamTargets.length })}</DetailsSectionCell>
                  </TableRow>
                  <TableRow>
                    <DetailsCellHost colSpan={2} className={FLUSH_CELL_CLASS}>
                      <DetailsSubTable>
                        <TableHead>
                          <TableRow>
                            <DetailsHeaderCell>{t('mediaInfo.stream')}</DetailsHeaderCell>
                            <DetailsHeaderCell>{t('batchQueue.detailsOutput')}</DetailsHeaderCell>
                            <DetailsHeaderCell>{t('batchQueue.detailsOptions')}</DetailsHeaderCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {streamTargets.map((target) => (
                            <TableRow key={target.output}>
                              <DetailsStreamCell>{target.label ?? basename(target.output)}</DetailsStreamCell>
                              <DetailsOutputCell>
                                <DetailsPath>{target.output}</DetailsPath>
                              </DetailsOutputCell>
                              <DetailsCellValue>
                                {buildOptionRows(target.options)
                                  .map((row) => `${row.label}: ${row.value}`)
                                  .join(' · ')}
                              </DetailsCellValue>
                            </TableRow>
                          ))}
                        </TableBody>
                      </DetailsSubTable>
                    </DetailsCellHost>
                  </TableRow>
                </>
              )}
              {jobOptionRows.length > 0 && (
                <>
                  <TableRow>
                    <DetailsSectionCell colSpan={2}>{t('batchQueue.detailsOptions')}</DetailsSectionCell>
                  </TableRow>
                  {jobOptionRows.map((row) => (
                    <TableRow key={row.label}>
                      <DetailsCellLabel>{row.label}</DetailsCellLabel>
                      <DetailsCellValue>{row.value}</DetailsCellValue>
                    </TableRow>
                  ))}
                </>
              )}
              <TableRow>
                <DetailsCellLabel>{t('batchQueue.detailsTranscoder')}</DetailsCellLabel>
                <DetailsCellValue>{job.transcoder}</DetailsCellValue>
              </TableRow>
              {job.error && (
                <TableRow>
                  <DetailsCellLabel>{t('batchQueue.detailsError')}</DetailsCellLabel>
                  <DetailsCellValue color="error">{job.error}</DetailsCellValue>
                </TableRow>
              )}
              <TableRow>
                <DetailsCellLabel>{t('muxQueue.detailsCreatedAt')}</DetailsCellLabel>
                <DetailsCellValue>{new Date(job.createdAt).toLocaleString()}</DetailsCellValue>
              </TableRow>
            </TableBody>
          </DetailsTable>
        </DetailsBox>
      </Collapse>
    </JobCard>
  );
}
