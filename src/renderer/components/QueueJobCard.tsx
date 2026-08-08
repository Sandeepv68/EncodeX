/**
 * @fileoverview Single job card in the batch queue list.
 *
 * Renders one conversion job as an outlined card showing the input filename
 * (with a preview thumbnail for image/video inputs), its queue status as a
 * colored chip, the output path, an in-card progress bar while running, and
 * any error text. Per-job actions include removing the job, revealing its
 * output in the OS file manager, copying the output path, reordering queued
 * jobs (up/down arrows), and (for failed jobs) retrying.
 *
 * Status colors map QUEUE_STATUS values to MUI chip colors (queued = warning,
 * running = primary, done = success, error = error). The progress bar is
 * wrapped in an ErrorBoundary so a renderer failure in one card never breaks
 * the queue list.
 *
 * Props (see {@link QueueJobCardProps}):
 *  - job: the QueueJob to display.
 *  - progress: optional live ConversionProgress snapshot (time/speed/eta).
 *  - onRemove: callback invoked with the job id when the user removes it.
 *  - onMove: callback invoked with the job id and direction (-1 up, 1 down)
 *    when a queued job's reorder arrow is clicked.
 *
 * Every card has a chevron toggle that expands an MUI Collapse panel with the
 * full error (when present), a compact summary of the encoding options
 * (codecs, bitrates, scale, hwaccel, ...), the transcoder, and the creation
 * timestamp.
 */

import { useEffect, useState } from 'react';
import { Collapse, IconButton, Tooltip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  faTrashCan,
  faRotateRight,
  faFolderOpen,
  faCopy,
  faArrowUp,
  faArrowDown,
  faChevronUp,
  faChevronDown,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ErrorBoundary } from './ErrorBoundary';
import ProgressBar from './ProgressBar';
import type { QueueJobCardProps } from './types';
import type { ConversionOptions } from '../../shared/types';
import { QUEUE_STATUS } from '../../shared/media-options';
import { isImageFile, isVideoFile } from '../../shared/file-extensions';
import { useToastStore } from '../stores/toastStore';
import {
  JobCard,
  CardBody,
  CardContent,
  ThumbImg,
  CardHeaderRow,
  JobNameText,
  StatusChip,
  CardActionsStack,
  DetailsBox,
  DetailsLabel,
  OptionsGrid,
  OptionRow,
} from '../styles/QueueJobCard.styles';

/**
 * Maps QUEUE_STATUS values to MUI Chip color props used for the status chip.
 * @type {Record<string, 'default' | 'primary' | 'success' | 'error' | 'warning'>}
 */
const statusColors: Record<string, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
  [QUEUE_STATUS.QUEUED]: 'warning',
  [QUEUE_STATUS.RUNNING]: 'primary',
  [QUEUE_STATUS.DONE]: 'success',
  [QUEUE_STATUS.ERROR]: 'error',
};

/**
 * Extracts the basename of a file path, handling both Windows backslashes and
 * POSIX forward slashes.
 * @param {string} path - The file path to process.
 * @returns {string} The trailing path segment, or the original path when it
 *   has no separators.
 */
function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/**
 * Renders a single batch queue job card.
 *
 * Shows the input file's basename (see {@link basename}) and a status chip in
 * the header row (with a preview thumbnail for image/video inputs), the output
 * path below, a {@link ProgressBar} while the job is running, and the error
 * message when the job failed.
 * @param {QueueJobCardProps} props - Component props.
 * @param {QueueJob} props.job - The conversion job to display.
 * @param {(id: string) => void} props.onRemove - Callback fired with the job's
 *   id when the remove button is clicked.
 * @returns {JSX.Element} The job card.
 */
export default function QueueJobCard({ job, progress, onRemove, onRetry, onMove }: QueueJobCardProps) {
  const { t } = useTranslation();

  /**
   * True while the expandable details panel is shown.
   * @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]}
   */
  const [expanded, setExpanded] = useState(false);

  /**
   * Data URL of the job's media thumbnail (preview frame for video, scaled
   * image preview for images), or null while loading/for unsupported files.
   * @type {[string | null, React.Dispatch<React.SetStateAction<string | null>>]}
   */
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  /**
   * On mount, fetches a thumbnail for the job's input via the image/video
   * preview IPC channels (audio files have no preview). Failures and null
   * results keep the card thumbnail-less; the state is only updated when a
   * preview actually arrives so cards can render without any async churn.
   * @returns {void}
   */
  useEffect(() => {
    let cancelled = false;
    const loadThumbnail = async () => {
      try {
        const dataUrl = isImageFile(job.input)
          ? await window.electronAPI.getImagePreview(job.input)
          : isVideoFile(job.input)
            ? await window.electronAPI.getVideoPreview(job.input)
            : null;
        if (!cancelled && dataUrl) setThumbnail(dataUrl);
      } catch {
        if (!cancelled) setThumbnail(null);
      }
    };
    loadThumbnail();
    return () => {
      cancelled = true;
    };
  }, [job.input]);

  /**
   * Builds the compact label/value rows summarizing a job's encoding options.
   * Only options that are actually set on the job are listed, so the summary
   * stays short; booleans render as Yes/No.
   * @param {ConversionOptions} options - The job's conversion options.
   * @returns {{label: string, value: string}[]} The ordered summary rows.
   */
  const buildOptionRows = (options: ConversionOptions): { label: string; value: string }[] => {
    const rows: { label: string; value: string }[] = [];
    const yes = t('batchQueue.yes');
    const no = t('batchQueue.no');
    if (options.videoCodec) rows.push({ label: t('batchQueue.optionVideoCodec'), value: options.videoCodec });
    if (options.audioCodec) rows.push({ label: t('batchQueue.optionAudioCodec'), value: options.audioCodec });
    if (options.videoBitrate) rows.push({ label: t('batchQueue.optionVideoBitrate'), value: options.videoBitrate });
    if (options.audioBitrate) rows.push({ label: t('batchQueue.optionAudioBitrate'), value: options.audioBitrate });
    if (options.qscale !== undefined) rows.push({ label: t('batchQueue.optionQscale'), value: String(options.qscale) });
    if (options.scale) rows.push({ label: t('batchQueue.optionScale'), value: options.scale });
    if (options.pixelFormat) rows.push({ label: t('batchQueue.optionPixelFormat'), value: options.pixelFormat });
    if (options.startTime || options.endTime) {
      rows.push({ label: t('batchQueue.optionTrim'), value: [options.startTime, options.endTime].filter(Boolean).join(' \u2192 ') });
    }
    if (options.duration) rows.push({ label: t('batchQueue.optionDuration'), value: options.duration });
    if (options.copy !== undefined) rows.push({ label: t('batchQueue.optionCopy'), value: options.copy ? yes : no });
    if (options.audio !== undefined) rows.push({ label: t('batchQueue.optionAudio'), value: options.audio ? yes : no });
    if (options.hardwareAcceleration !== undefined) {
      rows.push({ label: t('batchQueue.optionHwaccel'), value: options.hardwareAcceleration ? yes : no });
    }
    if (options.hwaccelMode) rows.push({ label: t('batchQueue.optionHwaccelMode'), value: options.hwaccelMode });
    return rows;
  };

  /**
   * Reveals the job's output file in the OS file manager via the main process.
   * @returns {Promise<void>} Resolves once the reveal request is issued.
   */
  const handleReveal = async () => {
    await window.electronAPI.revealFile(job.output);
  };

  /**
   * Copies the job's output path to the clipboard and confirms via a toast.
   * @returns {Promise<void>} Resolves once the path is copied (or fails).
   */
  const handleCopyPath = async () => {
    await navigator.clipboard.writeText(job.output);
    useToastStore.getState().success(t('toast.pathCopied'));
  };

  const optionRows = buildOptionRows(job.options);
  const detailsLabel = expanded ? t('batchQueue.collapseDetails') : t('batchQueue.expandDetails');

  return (
    <JobCard $status={job.status} variant="outlined">
      <CardBody>
        {thumbnail && <ThumbImg src={thumbnail} alt="" data-testid="queue-job-thumbnail" />}
        <CardContent>
          <CardHeaderRow>
            <Tooltip title={job.input} arrow>
              <JobNameText variant="body2">{basename(job.input)}</JobNameText>
            </Tooltip>
            <CardActionsStack direction="row" spacing={1}>
              <StatusChip label={job.status} color={statusColors[job.status] || 'default'} variant="outlined" />
              {job.status === QUEUE_STATUS.QUEUED && onMove && (
                <>
                  <Tooltip title={t('batchQueue.moveUp')}>
                    <IconButton size="small" aria-label={t('batchQueue.moveUp')} onClick={() => onMove(job.id, -1)}>
                      <FontAwesomeIcon icon={faArrowUp} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('batchQueue.moveDown')}>
                    <IconButton size="small" aria-label={t('batchQueue.moveDown')} onClick={() => onMove(job.id, 1)}>
                      <FontAwesomeIcon icon={faArrowDown} />
                    </IconButton>
                  </Tooltip>
                </>
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
          {job.error && !expanded && (
            <Typography variant="caption" color="error">
              {job.error}
            </Typography>
          )}
        </CardContent>
      </CardBody>
      <Collapse in={expanded}>
        <DetailsBox>
          <DetailsLabel variant="caption" color="text.secondary">
            {t('batchQueue.detailsOutput')}
          </DetailsLabel>
          <Typography variant="caption">{job.output}</Typography>
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
          {optionRows.length > 0 && (
            <>
              <DetailsLabel variant="caption" color="text.secondary">
                {t('batchQueue.detailsOptions')}
              </DetailsLabel>
              <OptionsGrid>
                {optionRows.map((row) => (
                  <OptionRow key={row.label}>
                    <Typography variant="caption" color="text.secondary">
                      {row.label}:
                    </Typography>
                    <Typography variant="caption">{row.value}</Typography>
                  </OptionRow>
                ))}
                <OptionRow>
                  <Typography variant="caption" color="text.secondary">
                    {t('batchQueue.detailsTranscoder')}:
                  </Typography>
                  <Typography variant="caption">{job.transcoder}</Typography>
                </OptionRow>
              </OptionsGrid>
            </>
          )}
          <DetailsLabel variant="caption" color="text.secondary">
            {t('batchQueue.detailsCreatedAt')}
          </DetailsLabel>
          <Typography variant="caption">{new Date(job.createdAt).toLocaleString()}</Typography>
        </DetailsBox>
      </Collapse>
    </JobCard>
  );
}
