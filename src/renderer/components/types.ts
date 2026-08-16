/**
 * @fileoverview Type definitions for renderer components.
 * Defines prop shapes and shared types used across the component layer.
 */

import type { ReactNode, Ref, RefObject, ReactElement } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type {
  AppError,
  ConversionOptions,
  ConversionProgress,
  EncoderType,
  MediaInfo,
  MediaStreamInfo,
  QueueJob,
  ThumbnailStrip,
  TranscoderType,
  WaveformData,
  WhenDoneConfig,
} from '../../shared/types';
import type { BatchEncodingValues } from '../utils/batch-options';

/**
 * Props for the application navigation drawer.
 * @interface AppDrawerProps
 */
export interface AppDrawerProps {
  isMobile: boolean;
  onNavigate: () => void;
  condensed: boolean;
  onToggleCondense: () => void;
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
  operation: string;
  onOperationChange: (operation: string) => void;
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
  hasRunning: boolean;
  hasQueued: boolean;
  onStart: () => void;
  hasActive: boolean;
  outputDir: string;
  onOutputDirChange: (dir: string) => void;
  onBrowseDir: () => void;
  overwrite: boolean;
  onOverwriteChange: (overwrite: boolean) => void;
  whenDone: WhenDoneConfig;
  onWhenDoneChange: (config: WhenDoneConfig) => void;
  onExport: () => void;
  onImport: () => void;
  /**
   * Whether the hardware-acceleration info alert should be shown inside the
   * controls box. Dismissal state is tracked by the shared dismissed-alerts
   * store.
   */
  hardwareAccelAlert?: boolean;
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
 * Props for the batch encoding options panel.
 * @interface BatchEncodingPanelProps
 * @property {string} operation - The selected batch operation value; the panel
 *   shows video controls for 'transcode', audio controls for 'extract_audio',
 *   and image controls (format/quality/scale) for 'compress_image'.
 * @property {string} videoCodec - Selected video encoder name.
 * @property {string} audioCodec - Selected audio encoder name.
 * @property {string} container - Selected output container/format extension; ''
 *   means keep the source file's extension.
 * @property {string} videoBitrate - Target video bitrate ('' = encoder default).
 * @property {string} audioBitrate - Target audio bitrate ('' = encoder default).
 * @property {string} quality - Image compression quality 1-31 ('' = encoder default).
 * @property {string} scale - Output resolution as WIDTHxHEIGHT ('' = original).
 * @property {string} pixelFormat - Output pixel format (e.g. 'yuv420p').
 * @property {boolean} [optionsLocked] - Whether the batch is running, locking the
 *   options; shows the options-locked warning alert inside the panel.
 * @property {boolean} [optionsEditable] - Whether queued jobs allow their options
 *   to be changed; shows the options-editable info alert inside the panel.
 * @property {(value: string) => void} onVideoCodecChange - Fired on video codec change.
 * @property {(value: string) => void} onAudioCodecChange - Fired on audio codec change.
 * @property {(value: string) => void} onContainerChange - Fired on container change.
 * @property {(value: string) => void} onVideoBitrateChange - Fired on video bitrate change.
 * @property {(value: string) => void} onAudioBitrateChange - Fired on audio bitrate change.
 * @property {(value: string) => void} onQualityChange - Fired on quality change.
 * @property {(value: string) => void} onScaleChange - Fired on scale change.
 * @property {(value: string) => void} onPixelFormatChange - Fired on pixel format change.
 */
export interface BatchEncodingPanelProps {
  operation: string;
  videoCodec: string;
  audioCodec: string;
  container: string;
  videoBitrate: string;
  audioBitrate: string;
  quality: string;
  scale: string;
  pixelFormat: string;
  optionsLocked?: boolean;
  optionsEditable?: boolean;
  onVideoCodecChange: (value: string) => void;
  onAudioCodecChange: (value: string) => void;
  onContainerChange: (value: string) => void;
  onVideoBitrateChange: (value: string) => void;
  onAudioBitrateChange: (value: string) => void;
  onQualityChange: (value: string) => void;
  onScaleChange: (value: string) => void;
  onPixelFormatChange: (value: string) => void;
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
  id?: string;
  ariaLabel?: string;
  testId?: string;
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
 * Props for the shared labeled form field wrapper.
 * @interface FormFieldProps
 * @property {string} label - Field label text rendered as a real `<label>`.
 * @property {string} [hint] - Optional tooltip text shown next to the label.
 * @property {boolean} [required] - When true an `aria-hidden` required marker
 *   (`*`) is rendered after the label without breaking exact text queries.
 * @property {string} [error] - Optional error message shown as an error helper
 *   line below the control.
 * @property {string} [helperText] - Optional helper text shown below the control
 *   (a single space can be used to reserve a helper line).
 * @property {string} [htmlFor] - Optional explicit control id; defaults to a
 *   `useId`-generated id used for label↔input association.
 * @property {string} [testId] - Test id applied to the wrapping box.
 * @property {(id: string) => ReactNode} children - Render-prop receiving the
 *   control id so the caller can wire `id` onto the actual input.
 */
export interface FormFieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  htmlFor?: string;
  testId?: string;
  children: (id: string) => ReactNode;
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
  required?: boolean;
  testId?: string;
}

/**
 * Props for the shared media preview thumbnail box.
 * @interface MediaPreviewProps
 * @property {string | null} imageSrc - Data URL of the preview thumbnail, or
 *   null while loading (no `<img>` is rendered then).
 * @property {string} alt - Alt text for the preview image (the source file name).
 * @property {string} removeLabel - Accessible label for the remove button.
 * @property {string} testId - Test id applied to the wrapping preview box.
 * @property {string} removeTestId - Test id applied to the remove button.
 * @property {'square' | 'wide'} [variant] - Aspect of the thumbnail: 'square'
 *   (96x96, used for images) or 'wide' (160x90, used for videos).
 * @property {() => void} onRemove - Fired when the remove button is clicked.
 * @property {ReactNode} children - Info content rendered beside the thumbnail.
 */
export interface MediaPreviewProps {
  imageSrc: string | null;
  alt: string;
  removeLabel: string;
  testId: string;
  removeTestId: string;
  variant?: 'square' | 'wide';
  onRemove: () => void;
  children: ReactNode;
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
  id?: string;
  ariaLabel?: string;
  testId?: string;
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
  /** When true, the progress track is rendered with a soft resting shadow. */
  shadowed?: boolean;
}

/**
 * Props for a single job card in the batch queue.
 * @interface QueueJobCardProps
 * @property {QueueJob} job - The conversion job to display.
 * @property {ConversionProgress | null | undefined} [progress] - Latest live
 *   progress snapshot (time/speed/eta captions) for the running job.
 * @property {(id: string) => void} onRemove - Fired with the job id on remove.
 * @property {(job: QueueJob) => void} [onRetry] - Fired with the failed job when
 *   the retry action is used.
 * @property {(job: QueueJob) => void} [onEditOptions] - Fired with the QUEUED job
 *   when the edit-options action is used.
 * @property {boolean} [editLocked] - When true the edit-options action is
 *   disabled (the batch is already running) and a tooltip explains why.
 * @property {boolean} [customized] - When true the card shows a small marker
 *   indicating the job's options differ from the current panel values.
 * @property {boolean} [dragOverlay] - When true the card is rendered as a static
 *   clone for the drag overlay (no sortable wiring, no drag handle).
 */
export interface QueueJobCardProps {
  job: QueueJob;
  progress?: ConversionProgress | null;
  onRemove: (id: string) => void;
  onRetry?: (job: QueueJob) => void;
  onEditOptions?: (job: QueueJob) => void;
  editLocked?: boolean;
  customized?: boolean;
  dragOverlay?: boolean;
}

/**
 * Props for the per-job encoding options dialog.
 * @interface QueueJobOptionsDialogProps
 * @property {boolean} open - Whether the dialog is shown.
 * @property {QueueJob | null} job - The job being edited; null hides the dialog.
 * @property {BatchEncodingValues} defaults - The page's current encoding field
 *   values, used to seed any field the job's options do not carry.
 * @property {(job: QueueJob, options: ConversionOptions, output: string) => void}
 *   onSave - Fired with the job, the built options, and the recomputed output
 *   path when the user confirms.
 * @property {() => void} onClose - Fired when the dialog is dismissed without
 *   saving.
 */
export interface QueueJobOptionsDialogProps {
  open: boolean;
  job: QueueJob | null;
  defaults: BatchEncodingValues;
  onSave: (job: QueueJob, options: ConversionOptions, output: string) => void;
  onClose: () => void;
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
  formatHint?: string;
  required?: boolean;
  testId?: string;
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
