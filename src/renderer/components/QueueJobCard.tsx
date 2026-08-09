/**
 * @fileoverview Single job card in the batch queue list.
 *
 * Renders one conversion job as an outlined card showing the input filename
 * (with a preview thumbnail for image/video inputs), its queue status as a
 * colored chip, the output path, an in-card progress bar while running, and
 * any error text. Per-job actions include removing the job, revealing its
 * output in the OS file manager, copying the output path, drag-and-drop
 * reordering of queued jobs (via a grip handle), and (for failed jobs)
 * retrying.
 *
 * Status colors map QUEUE_STATUS values to MUI chip colors (queued = warning,
 * running = primary, done = success, error = error). The progress bar is
 * wrapped in an ErrorBoundary so a renderer failure in one card never breaks
 * the queue list.
 *
 * The default export wires the card into @dnd-kit's sortable context so QUEUED
 * jobs can be reordered by dragging the grip handle (non-queued jobs are not
 * draggable). The exported {@link QueueJobCardContent} is the presentational
 * body reused by the drag overlay preview.
 *
 * Props (see {@link QueueJobCardProps}):
 *  - job: the QueueJob to display.
 *  - progress: optional live ConversionProgress snapshot (time/speed/eta).
 *  - onRemove: callback invoked with the job id when the user removes it.
 *  - onRetry: callback invoked with the failed job when retrying.
 *  - dragOverlay: renders a static clone for the drag overlay (no sortable
 *    wiring, no drag handle).
 *
 * Every card has a chevron toggle that expands an MUI Collapse panel with the
 * full error (when present), a compact summary of the encoding options
 * (codecs, bitrates, scale, hwaccel, ...), the transcoder, and the creation
 * timestamp.
 *
 * Thumbnails are lazy: the expensive preview IPC call (which spawns ffmpeg for
 * videos) is deferred until the card scrolls near the viewport via an
 * IntersectionObserver, so large queues only pay for previews the user can
 * actually see. Once a thumbnail is generated it is cached per input path for
 * the whole session (see {@link getPreviewThumbnail}) and re-seeded
 * synchronously on remount (see {@link getResolvedPreviewThumbnail}), so
 * remounting a card — during drags, reordering, or page navigation — shows the
 * thumbnail instantly and never regenerates it.
 */

import { useEffect, useRef, useState } from 'react';
import { Collapse, Box, IconButton, Tooltip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDndContext } from '@dnd-kit/core';
import type { DraggableAttributes } from '@dnd-kit/core';
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
import type { QueueJobCardProps } from './types';
import type { ConversionOptions } from '../../shared/types';
import { QUEUE_STATUS } from '../../shared/media-options';
import { useToastStore } from '../stores/toastStore';
import { getPreviewThumbnail, getResolvedPreviewThumbnail } from '../utils/preview-cache';
import {
  JobCard,
  CardBody,
  CardContent,
  ThumbImg,
  CardHeaderRow,
  JobNameText,
  StatusChip,
  CardActionsStack,
  DragHandleButton,
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
 * Handle props forwarded from {@link QueueJobCard} to the presentational body.
 * @interface DragHandleProps
 * @property {DraggableAttributes} attributes - dnd-kit attributes for the handle.
 * @property {ReturnType<typeof useSortable>['listeners']} listeners - dnd-kit
 *   pointer/keyboard listeners for the handle.
 */
interface DragHandleProps {
  attributes: DraggableAttributes;
  listeners: ReturnType<typeof useSortable>['listeners'];
}

/**
 * Presentational body of a batch queue job card.
 *
 * Renders everything except the sortable wiring: thumbnail, header row
 * (filename, status chip, drag handle, actions), progress bar, error text, and
 * the expandable details panel. Shared between the live card and the drag
 * overlay clone (see {@link QueueJobCard}).
 * @param {QueueJobCardProps & { handleProps?: DragHandleProps }} props - Props.
 * @returns {JSX.Element} The card body.
 */
export function QueueJobCardContent({
  job,
  progress,
  onRemove,
  onRetry,
  dragOverlay,
  handleProps,
}: QueueJobCardProps & { handleProps?: DragHandleProps }) {
  const { t } = useTranslation();

  /**
   * True while the expandable details panel is shown.
   * @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]}
   */
  const [expanded, setExpanded] = useState(false);

  /**
   * Data URL of the job's media thumbnail (preview frame for video, scaled
   * image preview for images), or null while loading/for unsupported files.
   * Seeded from the renderer's session preview cache so a remounted card
   * (navigation, drag overlay, reorder) shows an already-generated thumbnail
   * instantly instead of waiting for an async fetch.
   * @type {[string | null, React.Dispatch<React.SetStateAction<string | null>>]}
   */
  const [thumbnail, setThumbnail] = useState<string | null>(() => getResolvedPreviewThumbnail(job.input));

  /**
   * True once the card has scrolled near the viewport, at which point the
   * thumbnail preview is actually fetched. Cards far off-screen stay lazy so a
   * large queue never spawns preview work the user cannot see.
   * @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]}
   */
  const [thumbnailInView, setThumbnailInView] = useState(false);

  /**
   * Anchor whose visibility drives the lazy thumbnail load.
   * @type {React.RefObject<HTMLDivElement | null>}
   */
  const thumbnailAnchorRef = useRef<HTMLDivElement | null>(null);

  /**
   * Marks the card as visible when its thumbnail anchor enters (or gets within
   * a generous margin of) the viewport. In test environments without an
   * IntersectionObserver the card is treated as immediately visible so previews
   * load unconditionally. Once observed, the observer disconnects.
   * @returns {void}
   */
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setThumbnailInView(true);
      return;
    }
    const node = thumbnailAnchorRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setThumbnailInView(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: '300px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /**
   * On mount (or once the card scrolls into view), fetches a thumbnail for the
   * job's input via the session-scoped preview cache (audio files have no
   * preview). The cache guarantees each input path is sent to the image/video
   * preview IPC at most once per session, so remounts, drag-overlay clones, and
   * page navigation reuse the generated thumbnail instead of regenerating it.
   * @returns {void}
   */
  useEffect(() => {
    if (!thumbnailInView) return;
    let cancelled = false;
    const loadThumbnail = async () => {
      const dataUrl = await getPreviewThumbnail(job.input);
      if (!cancelled && dataUrl) setThumbnail(dataUrl);
    };
    loadThumbnail();
    return () => {
      cancelled = true;
    };
  }, [thumbnailInView, job.input]);

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
    <>
      <CardBody ref={thumbnailAnchorRef}>
        {thumbnail && <ThumbImg src={thumbnail} alt="" data-testid="queue-job-thumbnail" />}
        <CardContent>
          <CardHeaderRow>
            <Box sx={{ flex: '1 1 0', minWidth: 0 }}>
              <EllipsisTooltip title={job.input}>
                <JobNameText variant="body2">{basename(job.input)}</JobNameText>
              </EllipsisTooltip>
            </Box>
            <CardActionsStack direction="row" spacing={1}>
              {job.status === QUEUE_STATUS.QUEUED && handleProps && !dragOverlay && (
                <Tooltip title={t('batchQueue.dragHandle')}>
                  <DragHandleButton
                    size="small"
                    aria-label={t('batchQueue.dragHandle')}
                    {...handleProps.attributes}
                    {...handleProps.listeners}
                  >
                    <FontAwesomeIcon icon={faGripVertical} />
                  </DragHandleButton>
                </Tooltip>
              )}
              <StatusChip label={job.status} color={statusColors[job.status] || 'default'} variant="outlined" />
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
    </>
  );
}

/**
 * Renders a single batch queue job card as a dnd-kit sortable item.
 *
 * QUEUED jobs expose a grip handle that starts a drag (pointer or keyboard);
 * non-queued jobs are sortable items but not draggable, so they act as static
 * drop targets. While dragging, the source card is faded out and the floating
 * preview is provided by the parent's DragOverlay.
 * @param {QueueJobCardProps} props - Component props.
 * @returns {JSX.Element} The sortable job card.
 */
export default function QueueJobCard({ job, progress, onRemove, onRetry }: QueueJobCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: job.id,
    disabled: job.status !== QUEUE_STATUS.QUEUED,
  });
  const { active } = useDndContext();
  const isDragActive = Boolean(active);

  return (
    <JobCard
      ref={setNodeRef}
      $status={job.status}
      variant="outlined"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragActive && !isDragging ? 'transform 250ms cubic-bezier(0.25, 1, 0.5, 1)' : undefined,
        opacity: isDragging ? 0 : undefined,
        willChange: isDragActive ? 'transform' : undefined,
      }}
    >
      <QueueJobCardContent job={job} progress={progress} onRemove={onRemove} onRetry={onRetry} handleProps={{ attributes, listeners }} />
    </JobCard>
  );
}
