/**
 * @fileoverview Video cutting page. Lets the user pick a video, set start/end
 * (or start + duration) points, optionally mute the audio, and cut the clip
 * without re-encoding. Corresponds to the `/video-cut` route and is the
 * destination of the Dashboard "Cut Video" feature card.
 *
 * Workflow: drop or pick a video -> the `MediaPlayer` loads it and reports its
 * duration; a `VideoTimeline` shows the waveform and thumbnail strip, which are
 * extracted asynchronously after the duration is known -> set the cut window on
 * the timeline or via the time fields -> click Cut. While the cut runs, the
 * timeline keeps its cut markers and pause/resume/cancel buttons are shown
 * together with a ProgressBar. Cancelling during a job or clearing the form is
 * guarded by `ConfirmDialog`s.
 *
 * The cut draft (input/output paths, cut window, audio toggle) and the cached
 * waveform/thumbnail data live in the `useVideoCutStore` (persisted draft to
 * localStorage, media cache in memory) so they survive navigation; remaining
 * playback/UI state is local (`useState`): pause and confirm-dialog flags,
 * playhead and video duration, waveform/thumbnail loading flags, and media
 * info. Conversion state comes from `useMediaTask`, field errors from
 * `useFormErrors`.
 *
 * IPC interactions:
 *  - `selectFile(...)` - open dialog for the source video.
 *  - `extractWaveform(path, duration)` - waveform data for the timeline.
 *  - `extractThumbnails(path, duration)` - thumbnail strip for the timeline.
 *  - `convertFile(...)` - stream-copies the cut segment (via `runTask`).
 *  - `pauseConversion()`, `resumeConversion()`, `cancelConversion()` - control
 *    the running cut job.
 *  - `onConversionProgress` - feeds the progress bar (via `useMediaTask`).
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Stack, Switch, Button, Typography, Tooltip, Box, IconButton } from '@mui/material';
import { faScissors, faPause, faPlay, faXmark, faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import PageContainer from '../components/PageContainer';
import FilePathField from '../components/FilePathField';
import FileDropZone from '../components/FileDropZone';
import InfoTooltip from '../components/InfoTooltip';
import ConfirmDialog from '../components/ConfirmDialog';
import { pageIcons } from '../pageIcons';
import TimeField from '../components/TimeField';
import MediaPlayer from '../components/MediaPlayer';
import type { MediaPlayerHandle } from '../components/types';
import VideoTimeline from '../components/VideoTimeline';
import ProgressBar from '../components/ProgressBar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Logger } from '../../shared/logger';
import { useErrorStore } from '../stores/errorStore';
import { useToastStore } from '../stores/toastStore';
import { ErrorCode } from '../../shared/errors';
import { isValidTime } from '../../shared/validation';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import type { MediaInfo } from '../../shared/types';
import { useMediaTask } from '../hooks/useMediaTask';
import { useFormErrors } from '../hooks/useFormErrors';
import { useHotkeys } from '../hooks/useHotkeys';
import { SHORTCUT_BY_ID, shortcutHint } from '../constants/shortcuts';
import { focusFirstError } from '../utils/focusFirstError';
import { useSettingsStore } from '../stores/settingsStore';
import { useDismissedAlertsStore, DISMISSED_ALERT_KEYS } from '../stores/dismissedAlertsStore';
import { useVideoCutStore } from '../stores/videoCutStore';
import { VIDEO_DROPZONE_ACCEPT } from '../../shared/file-extensions';
import { SectionHeader, FileChip, SectionsStack, HeadingGroup, AccelAlert, ActionRow } from '../styles/VideoCut.styles';
import { FieldLabel, ToggleRow, SectionCard, SectionTitle } from '../styles/form.styles';
import {
  LOG_ARROW,
  LOG_CANCELLING_CUT_JOB,
  LOG_CLEARING_VIDEO_CUT_FORM,
  LOG_CUTTING_VIDEO,
  LOG_FAILED_TO_EXTRACT_THUMBNAILS,
  LOG_FAILED_TO_EXTRACT_WAVEFORM,
  LOG_NO_INPUT_FILE_SELECTED,
  LOG_PAUSING_CUT_JOB,
  LOG_RESUMING_CUT_JOB,
  LOG_START,
  LOG_USE_DURATION,
  LOG_VALIDATION_FAILED,
} from '../../shared/log-constants';

/**
 * Logger instance scoped to this page. Reports cut starts, validation and
 * missing-input failures, pause/resume/cancel operations, form clearing, and
 * waveform/thumbnail extraction failures.
 * @const {Logger} log
 */
const log = new Logger('renderer/pages/VideoCut');

/**
 * Converts a time string to seconds. Accepts a plain number of seconds (e.g.
 * `42.5`) or an `HH:MM:SS[.mmm]` timestamp. Empty input returns null.
 * @param {string} value - The time string to parse.
 * @returns {number | null} The time in seconds, or null when the input is
 *   empty or not a valid format.
 */
function timeToSeconds(value: string): number | null {
  if (!value.trim()) return null;
  if (/^\d+(\.\d+)?$/.test(value.trim())) return parseFloat(value.trim());
  const match = /^(\d{1,2}):(\d{2}):(\d{2})(\.\d+)?$/.exec(value.trim());
  if (!match) return null;
  return parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseInt(match[3], 10) + (match[4] ? parseFloat(match[4]) : 0);
}

/**
 * Formats a number of seconds as an `HH:MM:SS` string, appending `.mmm`
 * milliseconds when there is a fractional part. Negative inputs are clamped to
 * zero.
 * @param {number} seconds - The time in seconds to format.
 * @returns {string} The formatted time string.
 */
function secondsToTime(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const base = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return ms > 0 ? `${base}.${ms.toString().padStart(3, '0')}` : base;
}

/**
 * Extracts the base file name from an absolute path, handling both `/` and `\`
 * separators (POSIX and Windows paths). Returns the original path when the
 * trailing segment is empty.
 * @param {string} filePath - The full file path to process.
 * @returns {string} The trailing path segment.
 */
function basename(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || filePath;
}

/**
 * Renders the video cutting page (`/video-cut`).
 *
 * Layout: when a video is selected, a preview `SectionCard` hosts the
 * `MediaPlayer` and the `VideoTimeline` (with cut markers, waveform, thumbnail
 * strip, and an audio toggle). A second `SectionCard` holds the file drop zone
 * / change-file button, the output path field, start/end-or-duration time
 * fields, the use-duration switch, and the Cut/pause/resume/cancel buttons.
 * While converting, a ProgressBar is shown. Two `ConfirmDialog`s guard job
 * cancellation and form clearing.
 *
 * State managed: local `useState` for every field described in the file header,
 * a `mediaPlayerRef` handle for programmatic seeks, `useMediaTask` for progress
 * and the `isConverting` flag, and `useFormErrors` for field errors. The
 * waveform and thumbnails are re-extracted whenever `input` or `videoDuration`
 * change.
 *
 * IPC interactions:
 *  - `selectFile(...)` - open dialog for the source video.
 *  - `extractWaveform(path, duration)` / `extractThumbnails(path, duration)` -
 *    timeline assets.
 *  - `convertFile(...)` - the stream-copy cut, wrapped by `runTask`.
 *  - `pauseConversion()`, `resumeConversion()`, `cancelConversion()` - job
 *    control.
 *
 * @returns {JSX.Element} The page content inside a PageContainer.
 */
export default function VideoCut() {
  const { t } = useTranslation();
  const settingsHardwareAcceleration = useSettingsStore((s) => s.hardwareAcceleration);

  /**
   * Absolute path of the selected source video, or '' when none.
   * @type {string}
   */
  const input = useVideoCutStore((s) => s.input);

  /**
   * Absolute path of the output file to write the cut clip to.
   * @type {string}
   */
  const output = useVideoCutStore((s) => s.output);

  /**
   * Cut start time as a `HH:MM:SS[.mmm]` string.
   * @type {string}
   */
  const startTime = useVideoCutStore((s) => s.startTime);

  /**
   * Cut end time, or '' when using the duration mode.
   * @type {string}
   */
  const endTime = useVideoCutStore((s) => s.endTime);

  /**
   * Cut duration (used instead of end time when `useDuration` is on).
   * @type {string}
   */
  const duration = useVideoCutStore((s) => s.duration);

  /**
   * When true, the cut window is specified by start time + duration instead of
   * start/end times.
   * @type {boolean}
   */
  const useDuration = useVideoCutStore((s) => s.useDuration);

  /**
   * Whether the audio stream is kept in the cut output.
   * @type {boolean}
   */
  const includeAudio = useVideoCutStore((s) => s.includeAudio);

  /**
   * Whether the running cut job is paused.
   * @type {boolean}
   */
  const [isPaused, setIsPaused] = useState(false);
  const accelAlertDismissed = useDismissedAlertsStore((s) => s.isDismissed(DISMISSED_ALERT_KEYS.HARDWARE_ACCEL));

  /**
   * Whether the "cancel running job" confirmation dialog is open.
   * @type {boolean}
   */
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  /**
   * Whether the "clear / cancel the current form" confirmation dialog is open.
   * @type {boolean}
   */
  const [jobCancelOpen, setJobCancelOpen] = useState(false);

  /**
   * Current playhead position in seconds reported by the MediaPlayer.
   * @type {number}
   */
  const [playhead, setPlayhead] = useState(0);

  /**
   * Total duration of the loaded video in seconds, reported by the MediaPlayer.
   * @type {number}
   */
  const [videoDuration, setVideoDuration] = useState(0);

  /**
   * Cached waveform data for the timeline, or null until extracted. Cached in
   * the video cut store (in memory) so it survives navigation away and back.
   * @type {WaveformData | null}
   */
  const waveform = useVideoCutStore((s) => s.waveform);

  /**
   * Cached thumbnail strip for the timeline, or null until extracted. Cached in
   * the video cut store (in memory) so it survives navigation away and back.
   * @type {ThumbnailStrip | null}
   */
  const thumbnails = useVideoCutStore((s) => s.thumbnails);

  /**
   * Cached timeline zoom level for the current video, or null. Cached in the
   * video cut store (in memory) so it survives navigation away and back.
   * @type {number | null}
   */
  const cachedZoom = useVideoCutStore((s) => s.zoom);
  const cachedZoomKey = useVideoCutStore((s) => s.zoomKey);

  /**
   * Probed media info of the selected video (used to locate video/audio
   * streams), or null until loaded.
   * @type {MediaInfo | null}
   */
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);

  /**
   * Whether the waveform extraction is currently in flight.
   * @type {boolean}
   */
  const [waveformLoading, setWaveformLoading] = useState(false);

  /**
   * Whether the thumbnail extraction is currently in flight.
   * @type {boolean}
   */
  const [thumbnailsLoading, setThumbnailsLoading] = useState(false);

  /**
   * Draft setter/actions from the video cut store.
   * @type {{
   *   setInput: (file: string) => void;
   *   setOutput: (file: string) => void;
   *   setStartTime: (time: string) => void;
   *   setEndTime: (time: string) => void;
   *   setDuration: (duration: string) => void;
   *   setUseDuration: (use: boolean) => void;
   *   setIncludeAudio: (include: boolean) => void;
   *   cacheWaveform: (data: WaveformData | null, key?: string | null) => void;
   *   cacheThumbnails: (data: ThumbnailStrip | null, key?: string | null) => void;
   *   cacheZoom: (zoom: number | null, key?: string | null) => void;
   *   setIsCutting: (v: boolean) => void;
   *   resetDraft: () => void;
   * }}
   */
  const {
    setInput,
    setOutput,
    setStartTime,
    setEndTime,
    setDuration,
    setUseDuration,
    setIncludeAudio,
    cacheWaveform,
    cacheThumbnails,
    cacheZoom,
    setIsCutting,
    setProgress: setCutProgress,
    resetForm: resetDraft,
  } = useVideoCutStore();

  /**
   * Imperative handle to the MediaPlayer, used to seek the player when the
   * timeline is scrubbed.
   * @type {React.MutableRefObject<MediaPlayerHandle | null>}
   */
  const mediaPlayerRef = useRef<MediaPlayerHandle>(null);
  const { progress, setProgress, isConverting, runTask } = useMediaTask();
  const { errors, setErrors, clearFieldError, setFieldError } = useFormErrors();
  const showErrorMessage = useErrorStore((s) => s.showErrorMessage);

  /**
   * Transcoder backend used for every cut from this page, fixed to the first
   * entry of TRANSCODER_TYPES.
   * @type {string}
   */
  const transcoder = TRANSCODER_TYPES[0];

  /**
   * Cut start position in seconds; defaults to 0 when unset.
   * @type {number}
   */
  const startSeconds = timeToSeconds(startTime) ?? 0;

  /**
   * Cut end position in seconds; undefined when unset or in duration mode.
   * @type {number | undefined}
   */
  const endSeconds = endTime ? (timeToSeconds(endTime) ?? undefined) : undefined;

  /**
   * First video stream of the probed media info, or null when none is found.
   * @type {import('../../shared/types').MediaStreamInfo | null}
   */
  const videoStream = mediaInfo?.streams.find((s) => s.type === 'video') ?? null;

  /**
   * First audio stream of the probed media info, or null when none is found.
   * @type {import('../../shared/types').MediaStreamInfo | null}
   */
  const audioStream = mediaInfo?.streams.find((s) => s.type === 'audio') ?? null;

  /**
   * Whether the form holds any unsaved input (file, output, or any non-default
   * cut setting). Drives the "cancel job" button visibility.
   * @type {boolean}
   */
  const isDirty = !!input || !!output || startTime !== '00:00:00' || !!endTime || !!duration || useDuration || !includeAudio;

  /**
   * Validates the cut form. Requires a non-empty output path and a valid start
   * time; when the duration mode is on a non-empty valid duration is required,
   * otherwise any entered end time must be valid. All problems are collected
   * into the errors map; on any failure false is returned.
   * @returns {boolean} True when validation passes and the cut may start.
   */
  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!output.trim()) next.output = t('validation.outputRequired');
    if (startTime && !isValidTime(startTime)) next.startTime = t('validation.invalidTime');
    if (useDuration) {
      if (!duration.trim()) next.duration = t('validation.durationRequired');
      else if (!isValidTime(duration)) next.duration = t('validation.invalidTime');
    } else if (endTime.trim() && !isValidTime(endTime)) {
      next.endTime = t('validation.invalidTime');
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusFirstError(next, ['output', 'startTime', 'duration', 'endTime'], {
        output: 'video-cut-output',
        startTime: 'video-cut-start',
        duration: 'video-cut-duration',
        endTime: 'video-cut-end',
      });
    }
    return Object.keys(next).length === 0;
  };

  /**
   * Resets every form field, media-derived state, and progress back to its
   * initial value: input/output paths, the cut window, audio toggle, pause and
   * playhead, video duration, the cached waveform/thumbnails, media info,
   * progress, and field errors. Shared by the cancel and clear handlers. The
   * draft fields, media cache, and persisted snapshot are cleared through the
   * store.
   * @returns {void}
   */
  const resetForm = () => {
    resetDraft();
    setIsPaused(false);
    setPlayhead(0);
    setVideoDuration(0);
    setMediaInfo(null);
    setWaveformLoading(false);
    setThumbnailsLoading(false);
    setProgress(null);
    setErrors({});
  };

  /**
   * Extracts the waveform and thumbnail strip for the selected video once its
   * duration is known, unless already cached in the video cut store for the same
   * input + duration (the cache survives navigation away and back, so revisiting
   * the page never re-extracts). Each missing item is requested in isolation, so
   * a partial cache is completed rather than discarded. Requests are deferred to
   * the next task via a 0ms timeout so they run after render; results are
   * discarded if the effect is cleaned up (e.g. a new file or duration arrives),
   * and failures are logged and only clear the respective loading flag. The
   * timeout is cleared and a cancellation flag set on cleanup.
   * @returns {() => void} Cleanup that cancels in-flight extraction updates and
   *   clears the scheduled timer.
   */
  useEffect(() => {
    if (!input || videoDuration <= 0) return;
    let cancelled = false;

    const cacheKey = `${input}::${videoDuration}`;
    const { waveform: cachedWaveform, waveformKey, thumbnails: cachedThumbnails, thumbnailsKey } = useVideoCutStore.getState();
    const waveformCached = !!cachedWaveform && waveformKey === cacheKey;
    const thumbnailsCached = !!cachedThumbnails && thumbnailsKey === cacheKey;
    if (waveformCached && thumbnailsCached) return;

    if (!waveformCached) {
      cacheWaveform(null, null);
      setWaveformLoading(true);
    }
    if (!thumbnailsCached) {
      cacheThumbnails(null, null);
      setThumbnailsLoading(true);
    }

    const timer = window.setTimeout(() => {
      if (cancelled) return;

      if (!waveformCached) {
        window.electronAPI
          .extractWaveform(input, videoDuration)
          .then((data) => {
            if (cancelled) return;
            cacheWaveform(data, cacheKey);
            setWaveformLoading(false);
          })
          .catch((err: unknown) => {
            log.warn(LOG_FAILED_TO_EXTRACT_WAVEFORM, err);
            if (!cancelled) setWaveformLoading(false);
          });
      }

      if (!thumbnailsCached) {
        window.electronAPI
          .extractThumbnails(input, videoDuration)
          .then((data) => {
            if (cancelled) return;
            cacheThumbnails(data, cacheKey);
            setThumbnailsLoading(false);
          })
          .catch((err: unknown) => {
            log.warn(LOG_FAILED_TO_EXTRACT_THUMBNAILS, err);
            if (!cancelled) setThumbnailsLoading(false);
          });
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [input, videoDuration, cacheWaveform, cacheThumbnails]);

  /**
   * Mirrors the page-local cut progress into the video cut store while a cut
   * task is running so the navigation drawer's blip popover can surface it, and
   * clears it the moment the task is no longer running. The store write happens
   * via getState() so the effect does not re-subscribe to the whole store.
   * @returns {void}
   */
  useEffect(() => {
    setCutProgress(isConverting ? progress : null);
  }, [isConverting, progress, setCutProgress]);

  /**
   * Handles a newly selected or dropped video file. Clears all media-derived
   * state (start/end/duration, audio toggle, playhead, video duration, the
   * cached waveform/thumbnails, media info, and loading flags) and sets the new
   * input path so the MediaPlayer reloads and the extraction effect re-runs.
   * @param {string} path - Absolute path of the selected video file.
   * @returns {void}
   */
  const handleFileSelect = (path: string) => {
    setInput(path);
    setStartTime('00:00:00');
    setEndTime('');
    setDuration('');
    setIncludeAudio(true);
    setPlayhead(0);
    setVideoDuration(0);
    cacheWaveform(null, null);
    cacheThumbnails(null, null);
    cacheZoom(null, null);
    setMediaInfo(null);
    setWaveformLoading(false);
    setThumbnailsLoading(false);
  };

  /**
   * Seeks both the playhead state and the MediaPlayer to the given time when
   * the timeline is scrubbed.
   * @param {number} time - The target position in seconds.
   * @returns {void}
   */
  const handleTimelineSeek = (time: number) => {
    setPlayhead(time);
    mediaPlayerRef.current?.seekTo(time);
  };

  /**
   * Opens a native file dialog filtered to the video drop-zone extensions and
   * forwards the chosen file to {@link handleFileSelect}.
   * @returns {Promise<void>} Resolves once the dialog is closed.
   */
  const handleBrowseVideo = async () => {
    const extList = [{ name: 'Files', extensions: VIDEO_DROPZONE_ACCEPT.split(',').map((s) => s.trim()) }];
    const file = await window.electronAPI.selectFile(extList);
    if (file) handleFileSelect(file);
  };

  /**
   * Validates the form and, when valid, ensures an input file is present and
   * starts the cut through `runTask`, which calls
   * `window.electronAPI.convertFile` with a stream-copy (`copy: true`) and the
   * configured cut window (start + end or duration) and optional audio removal.
   * While the task runs the store's `isCutting` flag is set so the navigation
   * drawer can show the activity blip; it is always cleared afterwards. A
   * success toast is shown on completion; on validation or missing-input
   * failures a warning is logged and an error message is shown.
   * @returns {Promise<void>} Resolves when the cut completes or fails.
   */
  const handleCut = async () => {
    if (!validate()) {
      log.warn(LOG_VALIDATION_FAILED);
      return;
    }
    if (!input) {
      log.warn(LOG_NO_INPUT_FILE_SELECTED);
      showErrorMessage(ErrorCode.INPUT_NOT_SPECIFIED, t('videoCut.validationRequired'));
      return;
    }
    log.info(LOG_CUTTING_VIDEO, input, LOG_ARROW, output, LOG_START, startTime, LOG_USE_DURATION, useDuration);
    setIsCutting(true);
    try {
      await runTask(async () => {
        await window.electronAPI.convertFile(
          input,
          output,
          {
            copy: true,
            startTime,
            ...(useDuration ? { duration } : { endTime }),
            ...(includeAudio ? {} : { audio: false }),
          },
          transcoder,
        );
        useToastStore.getState().success(t('toast.videoCut'));
      });
    } finally {
      setIsCutting(false);
    }
  };

  /**
   * Pauses the running cut job via `window.electronAPI.pauseConversion` and
   * marks the local pause state.
   * @returns {Promise<void>} Resolves once the pause request settles.
   */
  const pauseCut = async () => {
    log.info(LOG_PAUSING_CUT_JOB);
    await window.electronAPI.pauseConversion();
    setIsPaused(true);
  };

  /**
   * Resumes the paused cut job via `window.electronAPI.resumeConversion` and
   * clears the local pause state.
   * @returns {Promise<void>} Resolves once the resume request settles.
   */
  const resumeCut = async () => {
    log.info(LOG_RESUMING_CUT_JOB);
    await window.electronAPI.resumeConversion();
    setIsPaused(false);
  };

  /**
   * Confirms cancelling the running cut job: closes the confirmation dialog,
   * calls `window.electronAPI.cancelConversion`, and resets the whole form via
   * {@link resetForm}.
   * @returns {Promise<void>} Resolves once the cancel request settles.
   */
  const handleConfirmCancel = async () => {
    setCancelConfirmOpen(false);
    log.info(LOG_CANCELLING_CUT_JOB);
    await window.electronAPI.cancelConversion();
    resetForm();
  };

  /**
   * Confirms clearing the current (not running) form: closes the clear dialog,
   * logs the action, and resets the whole form via {@link resetForm}.
   * @returns {void}
   */
  const handleClearForm = () => {
    setJobCancelOpen(false);
    log.info(LOG_CLEARING_VIDEO_CUT_FORM);
    resetForm();
  };

  /**
   * Registers the page keyboard shortcuts (Ctrl+O open, Ctrl+Shift+S output,
   * Ctrl+Enter cut, Ctrl+Shift+P pause, Ctrl+Shift+C cancel, Ctrl+Shift+X
   * clear, U use duration, A include audio). The playback keys (Space, M, ←/→)
   * are registered by the MediaPlayer itself. Bindings mirror the enabled state
   * of the equivalent on-page controls.
   * @returns {void}
   */
  useHotkeys([
    { id: 'videoCut.open', handler: () => handleBrowseVideo() },
    {
      id: 'videoCut.output',
      handler: async () => {
        const f = await window.electronAPI.selectOutput();
        if (f) {
          setOutput(f);
          clearFieldError('output');
        }
      },
    },
    { id: 'videoCut.cut', handler: () => handleCut(), enabled: !!input && !!output && !isConverting },
    { id: 'videoCut.pause', handler: () => pauseCut(), enabled: isConverting && !isPaused },
    { id: 'videoCut.cancel', handler: () => setCancelConfirmOpen(true), enabled: isConverting },
    { id: 'videoCut.clear', handler: () => setJobCancelOpen(true), enabled: isDirty && !isConverting },
    { id: 'videoCut.useDuration', handler: () => setUseDuration(!useDuration) },
    { id: 'videoCut.includeAudio', handler: () => setIncludeAudio(!includeAudio) },
  ]);

  return (
    <PageContainer title={t('videoCut.title')} icon={pageIcons['/video-cut']} paper={false}>
      <SectionsStack>
        {input && (
          <SectionCard>
            <SectionHeader>
              <HeadingGroup>
                <SectionTitle variant="h6" component="h2">
                  {t('videoCut.preview')}
                </SectionTitle>
                <FileChip size="small" label={basename(input)} title={input} />
              </HeadingGroup>
              {!isConverting && (
                <Tooltip title={t('videoCut.closePreview')} arrow>
                  <IconButton size="small" aria-label={t('videoCut.closePreview')} onClick={() => setJobCancelOpen(true)}>
                    <FontAwesomeIcon icon={faXmark} />
                  </IconButton>
                </Tooltip>
              )}
            </SectionHeader>
            <ErrorBoundary fallback={null}>
              <MediaPlayer
                ref={mediaPlayerRef}
                filePath={input}
                onTimeUpdate={setPlayhead}
                onDurationChange={setVideoDuration}
                onMediaInfo={setMediaInfo}
              />
            </ErrorBoundary>
            <VideoTimeline
              duration={videoDuration}
              currentTime={playhead}
              start={startSeconds}
              end={endSeconds ?? videoDuration}
              waveform={waveform}
              thumbnails={thumbnails}
              waveformLoading={waveformLoading}
              thumbnailsLoading={thumbnailsLoading}
              zoom={cachedZoomKey === `${input}::${videoDuration}` ? cachedZoom : null}
              onZoomChange={(z) => cacheZoom(z, `${input}::${videoDuration}`)}
              audioEnabled={includeAudio}
              videoStream={videoStream}
              audioStream={audioStream}
              onAudioEnabledChange={setIncludeAudio}
              onSeek={handleTimelineSeek}
              onStartChange={(s) => setStartTime(secondsToTime(s))}
              onEndChange={(s) => setEndTime(secondsToTime(s))}
            />
          </SectionCard>
        )}

        <SectionCard>
          <SectionTitle variant="h6" component="h2">
            {t('videoCut.details')}
          </SectionTitle>

          {settingsHardwareAcceleration && !accelAlertDismissed && (
            <AccelAlert severity="info" onClose={() => useDismissedAlertsStore.getState().dismiss(DISMISSED_ALERT_KEYS.HARDWARE_ACCEL)}>
              {t('convert.hardwareAccelAlert')}
            </AccelAlert>
          )}

          <Box>
            <FieldLabel>
              {t('videoCut.videoFile')}
              <InfoTooltip title={t('videoCut.videoFileHint')} />
            </FieldLabel>
            {!input ? (
              <ErrorBoundary fallback={null}>
                <FileDropZone onFileSelect={handleFileSelect} label={t('videoCut.dropLabel')} accept={VIDEO_DROPZONE_ACCEPT} />
              </ErrorBoundary>
            ) : (
              <Tooltip title={t('videoCut.changeFileHint')} arrow>
                <Button
                  variant="outlined"
                  startIcon={<FontAwesomeIcon icon={faFolderOpen} />}
                  onClick={handleBrowseVideo}
                  data-testid="video-cut-change"
                >
                  {t('videoCut.changeFile')}
                </Button>
              </Tooltip>
            )}
          </Box>

          <FilePathField
            label={t('videoCut.outputFile')}
            hint={t('videoCut.outputFileHint')}
            required
            value={output}
            placeholder={t('videoCut.placeholderOutput')}
            buttonLabel={t('convert.browse')}
            testId="video-cut-output"
            onChange={(v) => {
              setOutput(v);
              clearFieldError('output');
            }}
            onBlur={() => {
              if (!output.trim()) setFieldError('output', t('validation.outputRequired'));
            }}
            error={errors.output}
            onBrowse={async () => {
              const f = await window.electronAPI.selectOutput();
              if (f) {
                setOutput(f);
                clearFieldError('output');
              }
            }}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TimeField
              label={t('videoCut.startTime')}
              hint={t('videoCut.startTimeHint')}
              formatHint={t('videoCut.timeFormatHint')}
              value={startTime}
              placeholder={t('videoCut.placeholderStart')}
              testId="video-cut-start"
              error={errors.startTime}
              onChange={(v) => {
                setStartTime(v);
                clearFieldError('startTime');
              }}
              onBlur={() => {
                if (startTime && !isValidTime(startTime)) setFieldError('startTime', t('validation.invalidTime'));
              }}
            />
            {useDuration ? (
              <TimeField
                label={t('videoCut.duration')}
                hint={t('videoCut.durationHint')}
                formatHint={t('videoCut.timeFormatHint')}
                value={duration}
                placeholder={t('videoCut.placeholderDuration')}
                testId="video-cut-duration"
                error={errors.duration}
                onChange={(v) => {
                  setDuration(v);
                  clearFieldError('duration');
                }}
                onBlur={() => {
                  if (duration && !isValidTime(duration)) setFieldError('duration', t('validation.invalidTime'));
                }}
              />
            ) : (
              <TimeField
                label={t('videoCut.endTime')}
                hint={t('videoCut.endTimeHint')}
                formatHint={t('videoCut.timeFormatHint')}
                value={endTime}
                placeholder={t('videoCut.placeholderEnd')}
                testId="video-cut-end"
                error={errors.endTime}
                onChange={(v) => {
                  setEndTime(v);
                  clearFieldError('endTime');
                }}
                onBlur={() => {
                  if (endTime && !isValidTime(endTime)) setFieldError('endTime', t('validation.invalidTime'));
                }}
              />
            )}
          </Stack>

          <ToggleRow>
            <Switch
              checked={useDuration}
              onChange={() => setUseDuration(!useDuration)}
              slotProps={{ input: { 'aria-label': t('videoCut.useDuration'), 'data-testid': 'video-cut-use-duration' } }}
            />
            <Typography variant="caption" color="text.secondary">
              {t('videoCut.useDuration')}
            </Typography>
            <InfoTooltip title={t('videoCut.useDurationHint')} />
          </ToggleRow>

          <ActionRow direction="row" spacing={1} useFlexGap>
            <Tooltip title={shortcutHint(t, 'videoCut.cutHint', SHORTCUT_BY_ID['videoCut.cut'].keys)} arrow>
              <span>
                <Button
                  variant="contained"
                  startIcon={<FontAwesomeIcon icon={faScissors} />}
                  onClick={handleCut}
                  disabled={!input || !output || isConverting}
                  data-testid="video-cut-cut"
                >
                  {isConverting ? t('videoCut.cutting') : t('videoCut.cut')}
                </Button>
              </span>
            </Tooltip>
            {isConverting && !isPaused && (
              <Button
                variant="contained"
                color="warning"
                startIcon={<FontAwesomeIcon icon={faPause} />}
                onClick={pauseCut}
                data-testid="video-cut-pause"
              >
                {t('videoCut.pause')}
              </Button>
            )}
            {isConverting && isPaused && (
              <Button
                variant="contained"
                color="success"
                startIcon={<FontAwesomeIcon icon={faPlay} />}
                onClick={resumeCut}
                data-testid="video-cut-resume"
              >
                {t('videoCut.resume')}
              </Button>
            )}
            {isConverting && (
              <Button
                variant="contained"
                color="error"
                startIcon={<FontAwesomeIcon icon={faXmark} />}
                onClick={() => setCancelConfirmOpen(true)}
                data-testid="video-cut-cancel"
              >
                {t('videoCut.cancel')}
              </Button>
            )}
            {isDirty && !isConverting && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<FontAwesomeIcon icon={faXmark} />}
                onClick={() => setJobCancelOpen(true)}
                data-testid="video-cut-cancel-job"
              >
                {t('videoCut.cancelJob')}
              </Button>
            )}
          </ActionRow>

          {progress && isConverting && (
            <ErrorBoundary fallback={null}>
              <ProgressBar
                percent={progress.percent}
                time={progress.time}
                speed={progress.speed}
                eta={progress.eta}
                paused={isPaused}
                shadowed
              />
            </ErrorBoundary>
          )}
        </SectionCard>
      </SectionsStack>

      <ConfirmDialog
        open={cancelConfirmOpen}
        title={t('videoCut.cancelTitle')}
        message={t('videoCut.cancelMessage')}
        confirmLabel={t('videoCut.yes')}
        cancelLabel={t('videoCut.no')}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={handleConfirmCancel}
      />

      <ConfirmDialog
        open={jobCancelOpen}
        title={t('videoCut.jobCancelTitle')}
        message={t('videoCut.jobCancelMessage')}
        confirmLabel={t('videoCut.yes')}
        cancelLabel={t('videoCut.no')}
        onClose={() => setJobCancelOpen(false)}
        onConfirm={handleClearForm}
      />
    </PageContainer>
  );
}
