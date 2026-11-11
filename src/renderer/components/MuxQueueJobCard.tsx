/**
 * @fileoverview Single job card in the mux queue list.
 *
 * Renders one remux or demux job as an outlined card: a kind chip (Remux /
 * Demux), the input filename, the queue status as a colored chip, an in-card
 * progress bar while running, the error text for failed jobs, and a summary of
 * the job's outputs - the single output file for a remux, or the number of
 * extracted streams and the output folder for a demux.
 *
 * The card can be expanded to list every target (label and output path), which
 * is what makes a multi-stream demux readable. Per-job actions are remove,
 * reveal-in-folder, and copy-path.
 *
 * The default export wires the card into @dnd-kit's sortable context so QUEUED
 * jobs can be reordered by dragging the grip handle; running and finished jobs
 * are not draggable.
 */

import { useState } from 'react';
import { Collapse, IconButton, Tooltip, Typography } from '@mui/material';
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
import { basename } from '../utils/path-utils';
import { statusChipColor } from '../utils/queue-job-utils';
import { useToastStore } from '../stores/toastStore';
import { QUEUE_STATUS } from '../../shared/media-options';
import type { MuxQueueJobCardProps } from './types';
import {
  JobCard,
  CardContent,
  CardHeaderRow,
  JobNameText,
  JobTitleWrapper,
  StatusChip,
  CardActionsStack,
  DragHandleButton,
  DetailsBox,
  DetailsLabel,
  OptionsGrid,
  OptionRow,
} from '../styles/QueueJobCard.styles';

/**
 * Renders a single mux queue job card as a dnd-kit sortable item.
 * @param {MuxQueueJobCardProps} props - Component props.
 * @returns {JSX.Element} The sortable job card.
 */
export default function MuxQueueJobCard({ job, progress, onRemove, onRetry }: MuxQueueJobCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
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

  return (
    <JobCard
      ref={setNodeRef}
      data-testid={`mux-queue-job-card-${job.id}`}
      $status={job.status}
      $transform={CSS.Transform.toString(transform)}
      $dragging={isDragging}
      variant="outlined"
    >
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
          {job.kind === 'demux'
            ? `${t('muxQueue.targets', { count: job.targets.length })} · ${t('muxQueue.outputDir')}: ${job.output}`
            : job.output}
        </Typography>
        {job.error && !expanded && (
          <Typography variant="caption" color="error" data-testid="mux-queue-job-error">
            {job.error}
          </Typography>
        )}
      </CardContent>
      <Collapse in={expanded}>
        <DetailsBox>
          <DetailsLabel variant="caption" color="text.secondary">
            {t('muxQueue.detailsTargets')}
          </DetailsLabel>
          {job.targets.length === 0 ? (
            <Typography variant="caption">{t('muxQueue.noOutputs')}</Typography>
          ) : (
            <OptionsGrid>
              {job.targets.map((target) => (
                <OptionRow key={target.output}>
                  <Typography variant="caption" color="text.secondary">
                    {target.label ?? basename(target.output)}:
                  </Typography>
                  <Typography variant="caption">{target.output}</Typography>
                </OptionRow>
              ))}
            </OptionsGrid>
          )}
          {job.error && (
            <>
              <DetailsLabel variant="caption" color="text.secondary">
                {t('batchQueue.detailsError')}
              </DetailsLabel>
              <Typography variant="caption" color="error">
                {job.error}
              </Typography>
            </>
          )}
          <DetailsLabel variant="caption" color="text.secondary">
            {t('muxQueue.detailsCreatedAt')}
          </DetailsLabel>
          <Typography variant="caption">{new Date(job.createdAt).toLocaleString()}</Typography>
        </DetailsBox>
      </Collapse>
    </JobCard>
  );
}
