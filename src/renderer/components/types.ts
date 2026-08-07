/**
 * @fileoverview Type definitions for renderer components.
 * Defines prop shapes and shared types used across the component layer.
 */

import type { ReactNode, Ref, RefObject, ReactElement } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type {
  AppError,
  ConversionProgress,
  EncoderType,
  MediaInfo,
  MediaStreamInfo,
  QueueJob,
  ThumbnailStrip,
  TranscoderType,
  WaveformData,
} from '../../shared/types';

/**
 * Props for the application navigation drawer.
 * @interface AppDrawerProps
 */
export interface AppDrawerProps {
  isMobile: boolean;
  onNavigate: () => void;
}

/**
 * Props for the audio stream summary component.
 * @interface AudioStreamInfoProps
 */
export interface AudioStreamInfoProps {
  streams: MediaStreamInfo[];
}

/**
 * Props for the batch conversion controls.
 * @interface BatchControlsProps
 */
export interface BatchControlsProps {
  operationRef: RefObject<string>;
  transcoderRef: RefObject<TranscoderType>;
  suffixRef: RefObject<string>;
  onAddFiles: () => void;
  onCancelAll: () => void;
  onClearCompleted: () => void;
  hasCompleted: boolean;
  concurrency: number;
  onConcurrencyChange: (concurrency: number) => void;
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  hasActive: boolean;
  outputDir: string;
  onOutputDirChange: (dir: string) => void;
  onBrowseDir: () => void;
  overwrite: boolean;
  onOverwriteChange: (overwrite: boolean) => void;
  onExport: () => void;
  onImport: () => void;
}

/**
 * A single decoded video frame held in the player frame buffer.
 * @interface BufferedFrame
 */
export interface BufferedFrame {
  data: Uint8Array;
  width: number;
  height: number;
  pts: number;
}

/**
 * Props for the codec selection dropdown.
 * @interface CodecSelectProps
 */
export interface CodecSelectProps {
  type: 'video' | 'audio';
  value: string;
  onChange: (value: string) => void;
  encoderType?: EncoderType;
}

/**
 * Props for the confirmation dialog.
 * @interface ConfirmDialogProps
 */
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * A single per-file selection made in the batch add review dialog.
 * @interface QueueAddReviewSelection
 * @property {string} file - Absolute path of the source file.
 * @property {string} operation - The batch operation chosen for this file
 *   (one of the BATCH_OPERATIONS values).
 */
export interface QueueAddReviewSelection {
  file: string;
  operation: string;
}

/**
 * Props for the batch add review dialog.
 * @interface QueueAddReviewDialogProps
 * @property {boolean} open - Whether the dialog is shown.
 * @property {string[]} files - Absolute paths of the files to review; each is
 *   rendered as a row with its own operation dropdown.
 * @property {string} defaultOperation - Operation value pre-filled on every row
 *   (the current toolbar operation).
 * @property {(selections: QueueAddReviewSelection[]) => void} onConfirm - Fired
 *   with one selection per file when the user confirms.
 * @property {() => void} onCancel - Fired when the dialog is dismissed without
 *   confirming.
 */
export interface QueueAddReviewDialogProps {
  open: boolean;
  files: string[];
  defaultOperation: string;
  onConfirm: (selections: QueueAddReviewSelection[]) => void;
  onCancel: () => void;
}

/**
 * Kind of drag interaction currently active on the timeline.
 * @typedef {string} DragKind
 */
export type DragKind = 'playhead' | 'start' | 'end' | 'move' | 'scrub';

/**
 * Props for the ellipsis tooltip component.
 * @interface EllipsisTooltipProps
 */
export interface EllipsisTooltipProps {
  title: string;
  children: ReactElement<{ ref?: Ref<HTMLElement> }>;
}

/**
 * Props for the dismissible error banner.
 * @interface ErrorBannerProps
 */
export interface ErrorBannerProps {
  error: AppError | null;
  onClose?: () => void;
}

/**
 * Props for the error boundary wrapper.
 * @interface ErrorBoundaryProps
 */
export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Internal state of the error boundary.
 * @interface ErrorBoundaryState
 */
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Props for the error snackbar.
 * @interface ErrorSnackbarProps
 */
export interface ErrorSnackbarProps {
  error: AppError | null;
  onClose: () => void;
}

/**
 * Props for the drag-and-drop file zone.
 * @interface FileDropZoneProps
 */
export interface FileDropZoneProps {
  onFileSelect: (path: string) => void;
  label?: string;
  accept?: string;
}

/**
 * Props for the file path input with browse button.
 * @interface FilePathFieldProps
 */
export interface FilePathFieldProps {
  label: string;
  value: string;
  placeholder: string;
  buttonLabel: string;
  onBrowse: () => void;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
}

/**
 * Props for the media file summary grid.
 * @interface FileSummaryProps
 */
export interface FileSummaryProps {
  info: MediaInfo;
  compact?: boolean;
}

/**
 * A single label/value row rendered by the file summary.
 * @interface SummaryRow
 */
export interface SummaryRow {
  label: string;
  value: string;
  size: { xs: number; sm?: number; md?: number; lg?: number };
}

/**
 * A grouped selectable option.
 * @interface GroupedOption
 */
export interface GroupedOption {
  value: string;
  label: string;
  group: string;
}

/**
 * Props for the grouped select dropdown.
 * @interface GroupedSelectProps
 */
export interface GroupedSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly GroupedOption[];
  groupIcons: Record<string, IconDefinition>;
}

/**
 * Props for the info tooltip icon.
 * @interface InfoTooltipProps
 */
export interface InfoTooltipProps {
  title: string;
}

/**
 * Imperative handle exposed by the media player.
 * @interface MediaPlayerHandle
 */
export interface MediaPlayerHandle {
  seekTo: (time: number) => void;
}

/**
 * Props for the media player component.
 * @interface MediaPlayerProps
 */
export interface MediaPlayerProps {
  filePath: string;
  onTimeUpdate?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
  onMediaInfo?: (info: MediaInfo) => void;
}

/**
 * Props for the page layout container.
 * @interface PageContainerProps
 */
export interface PageContainerProps {
  title: string;
  icon?: ReactNode;
  aside?: ReactNode;
  paper?: boolean;
  children: ReactNode;
}

/**
 * Props for the progress bar component.
 * @interface ProgressBarProps
 */
export interface ProgressBarProps {
  percent: number;
  time?: string;
  speed?: string;
  eta?: string;
  paused?: boolean;
}

/**
 * Props for a single job card in the batch queue.
 * @interface QueueJobCardProps
 * @property {QueueJob} job - The conversion job to display.
 * @property {ConversionProgress | null | undefined} [progress] - Latest live
 *   progress snapshot (time/speed/eta captions) for the running job.
 * @property {(id: string) => void} onRemove - Fired with the job id on remove.
 * @property {(id: string, direction: number) => void} [onMove] - Fired with the
 *   job id and direction (-1 up, 1 down) when a queued job is reordered.
 */
export interface QueueJobCardProps {
  job: QueueJob;
  progress?: ConversionProgress | null;
  onRemove: (id: string) => void;
  onRetry?: (job: QueueJob) => void;
  onMove?: (id: string, direction: number) => void;
}

/**
 * Props for the stream details panel.
 * @interface StreamDetailsProps
 */
export interface StreamDetailsProps {
  streams: MediaStreamInfo[];
  compact?: boolean;
}

/**
 * Props for the time input field.
 * @interface TimeFieldProps
 */
export interface TimeFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

/**
 * Props for the video cutting timeline.
 * @interface VideoTimelineProps
 * @property {number} duration - Clip duration in seconds.
 * @property {number} currentTime - Current playhead time in seconds.
 * @property {number} start - Start (in) trim point in seconds.
 * @property {number} end - End (out) trim point in seconds.
 * @property {WaveformData | null} [waveform] - Waveform data for the audio track.
 * @property {ThumbnailStrip | null} [thumbnails] - Thumbnail strip data for the video track.
 * @property {boolean} [waveformLoading] - Shows a skeleton while true.
 * @property {boolean} [thumbnailsLoading] - Shows a skeleton while true.
 * @property {boolean} [audioEnabled] - Whether the audio track is retained in the cut.
 * @property {MediaStreamInfo | null} [videoStream] - Video stream summary bubble.
 * @property {MediaStreamInfo | null} [audioStream] - Audio stream summary bubble.
 * @property {number | null} [zoom] - Controlled zoom level (pixels per second). When a
 *   number is provided the timeline is zoom-controlled by the parent (it ignores
 *   its internal duration-based initialization); null keeps the internal
 *   auto-fit zoom behavior.
 * @property {(zoom: number) => void} [onZoomChange] - Called with the next zoom level
 *   when the zoom buttons are used (in controlled mode).
 * @property {(time: number) => void} onSeek - Called when the playhead is scrubbed.
 * @property {(time: number) => void} onStartChange - Called when the start trim point changes.
 * @property {(time: number) => void} onEndChange - Called when the end trim point changes.
 * @property {(enabled: boolean) => void} [onAudioEnabledChange] - Called when the audio-enabled checkbox is toggled.
 */
export interface VideoTimelineProps {
  duration: number;
  currentTime: number;
  start: number;
  end: number;
  waveform?: WaveformData | null;
  thumbnails?: ThumbnailStrip | null;
  waveformLoading?: boolean;
  thumbnailsLoading?: boolean;
  audioEnabled?: boolean;
  videoStream?: MediaStreamInfo | null;
  audioStream?: MediaStreamInfo | null;
  zoom?: number | null;
  onZoomChange?: (zoom: number) => void;
  onSeek: (time: number) => void;
  onStartChange: (time: number) => void;
  onEndChange: (time: number) => void;
  onAudioEnabledChange?: (enabled: boolean) => void;
}
