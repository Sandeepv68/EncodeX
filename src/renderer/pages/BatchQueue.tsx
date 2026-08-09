/**
 * @fileoverview Batch conversion queue page. Manages a list of queued
 * conversion jobs that are processed by the main process. Corresponds to the
 * `/batch` route and is the destination of the Dashboard "Batch Convert"
 * feature card.
 *
 * The page shows configuration controls (operation, transcoder, output suffix)
 * via the `BatchControls` component and a scrollable list of jobs rendered as
 * `QueueJobCard`s. Jobs are added by selecting multiple files; each is enqueued
 * with `window.electronAPI.queueAdd` using options built from the active
 * operation, transcoder, and the hardware-acceleration settings stored in
 * `useSettingsStore`.
 *
 * The in-memory job list is kept in sync with the main process queue via
 * `window.electronAPI.queueList` (initial load) and the push subscriptions
 * `onQueueAdded`, `onQueueRemoved`, `onQueueStatusChange`, and `onQueueMoved`,
 * which feed the `useQueueStore` zustand store.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Stack, Typography } from '@mui/material';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent, Modifier } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import BatchControls from '../components/BatchControls';
import BatchEncodingPanel from '../components/BatchEncodingPanel';
import QueueJobCard, { QueueJobCardContent } from '../components/QueueJobCard';
import QueueAddReviewDialog from '../components/QueueAddReviewDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { useQueueStore } from '../stores/queueStore';
import { useToastStore } from '../stores/toastStore';
import { BATCH_OPERATIONS, DEFAULT_SUFFIX, QUEUE_STATUS } from '../../shared/media-options';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import { FILE_FILTERS, MEDIA_INPUT_EXTENSIONS, isImageFile } from '../../shared/file-extensions';
import {
  getAudioCodecContainers,
  getVideoCodecContainer,
  suggestedExtensionForAudioCodec,
  suggestedExtensionForVideoCodec,
} from '../../shared/codec-containers';
import { estimateRemaining, formatEstimate } from '../../shared/estimate';
import { QueueJob } from '../../shared/types';
import { useSettingsStore } from '../stores/settingsStore';
import { readStoredBatchConfig, persistBatchConfig, type BatchConfig } from '../stores/batchConfig';
import type { QueueAddReviewSelection } from '../components/types';
import type { HwAccelMode } from '../../shared/types';
import { computeQueuedTargetPosition, reorderJob } from '../utils/queue-reorder';
import { JobCard } from '../styles/QueueJobCard.styles';
import { PageTitle, EmptyText, FilterRow, FilterChip, SearchField, DropOverlay, AccelAlert } from '../styles/BatchQueue.styles';
import { TitleIcon } from '../styles/PageContainer.styles';
import { pageIcons } from '../pageIcons';

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
 * Shows a native OS notification (via the HTML5 Notification API, which
 * Electron's renderer surfaces as a real system notification). Permission is
 * requested once when the browser has not yet decided; failures and
 * unavailable notification support are swallowed so they can never break the
 * UI. The OS notification complements the in-app batch-finished toast.
 * @param {string} title - The notification title.
 * @param {string} body - The notification body text.
 * @returns {void}
 */
function showNativeCompletionNotification(title: string, body: string): void {
  try {
    if (typeof Notification === 'undefined') return;
    const show = () => {
      try {
        new Notification(title, { body });
      } catch {
        // Notification construction failed; the in-app toast still informs.
      }
    };
    if (Notification.permission === 'granted') {
      show();
    } else if (Notification.permission === 'default' && typeof Notification.requestPermission === 'function') {
      Notification.requestPermission()
        .then((permission: string) => {
          if (permission === 'granted') show();
        })
        .catch(() => {
          // Permission request failed; fall back to the toast alone.
        });
    }
  } catch {
    // Notification support missing entirely; fall back to the toast alone.
  }
}

/**
 * Normalizes a file path for duplicate comparison: lowercases and unifies
 * Windows backslashes with POSIX forward slashes.
 * @param {string} path - The file path to normalize.
 * @returns {string} The normalized path.
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase();
}

/**
 * Extracts the directory portion of a file path, handling both Windows
 * backslashes and POSIX forward slashes. The trailing separator is removed.
 * @param {string} file - The file path to process.
 * @returns {string} The directory path, or '' when the path has no separators.
 */
function getSourceDir(file: string): string {
  const idx = Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\'));
  return idx >= 0 ? file.slice(0, idx) : '';
}

/**
 * Extracts the basename stem (filename without its final extension). A leading
 * dot is not treated as an extension separator, so dotfiles (`.env`) keep their
 * whole name as the stem.
 * @param {string} file - The file path to process.
 * @returns {string} The basename without its extension.
 */
function getSourceStem(file: string): string {
  const base = basename(file);
  const dotIdx = base.lastIndexOf('.');
  return dotIdx > 0 ? base.slice(0, dotIdx) : base;
}

/**
 * Extracts the lowercase file extension from a path. Dotfiles (`.env`) have no
 * extension because a leading dot is not an extension separator.
 * @param {string} file - The file path to process.
 * @returns {string} The extension without a leading dot, or '' when there is none.
 */
function getSourceExtension(file: string): string {
  const base = basename(file);
  const dotIdx = base.lastIndexOf('.');
  return dotIdx > 0 ? base.slice(dotIdx + 1).toLowerCase() : '';
}

/**
 * Restricts the dragged card to vertical movement only, so reordering a queued
 * job cannot shift the card sideways while it is being dragged.
 * @type {Modifier}
 */
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/**
 * Renders the batch conversion queue page (`/batch`).
 *
 * Holds the batch configuration as controlled state (`operation`, `videoCodec`,
 * `audioCodec`, `container`, bitrates, `scale`, `pixelFormat`) bound to the
 * `BatchControls` toolbar and the `BatchEncodingPanel`, plus refs for the
 * transcoder and output suffix that never need to re-render. The visible job
 * list is read from `useQueueStore`.
 *
 * Side-effects on mount: the full job list is fetched with `queueList()`, and
 * the `onQueueAdded`, `onQueueRemoved`, and `onQueueStatusChange`
 * subscriptions are registered; each returns an unsubscribe that is run on
 * unmount.
 *
 * IPC interactions:
 *  - `selectFiles()` - multi-select dialog for the source files.
 *  - `queueAdd(input, output, options, transcoder)` - enqueue each file.
 *  - `queueRemove(id)` - remove/cancel a single job (per QueueJobCard).
 *  - `queueCancelAll()` - cancel every queued job.
 *  - `queueClearCompleted()` - drop every done and errored job.
 *  - `queueMoveTo(id, toPosition)` - reorder a queued job via drag-and-drop
 *    (per QueueJobCard's grip handle).
 *  - `queueList()` / `onQueueAdded` / `onQueueRemoved` / `onQueueStatusChange` /
 *    `onQueueMoved` - keep the in-memory job list in sync with the main process.
 *
 * Drag-and-drop reordering is powered by @dnd-kit: the visible card stack is a
 * SortableContext, the drop computes the dragged job's target position within
 * the QUEUED subsequence via `computeQueuedTargetPosition`, and the reorder is
 * committed by reordering the store optimistically (so the card snaps to its
 * new slot on release) and calling `queueMoveTo`. The `onQueueMoved` echo then
 * confirms the authoritative main-process order (an idempotent no-op here).
 *
 * @returns {JSX.Element} The page content.
 */
export default function BatchQueue() {
  const { t } = useTranslation();
  const { jobs, progress, addJob, removeJob, updateJob, updateProgress, clearJobs } = useQueueStore();
  const queueConcurrency = useSettingsStore((s) => s.queueConcurrency);
  const settingsHardwareAcceleration = useSettingsStore((s) => s.hardwareAcceleration);

  /**
   * Active status filter ('all' shows every job; otherwise one of QUEUE_STATUS).
   * @type {[string, React.Dispatch<React.SetStateAction<string>>]}
   */
  const [filter, setFilter] = useState('all');

  /**
   * Filename search term; jobs whose input basename includes it (case-insensitive)
   * are shown.
   * @type {[string, React.Dispatch<React.SetStateAction<string>>]}
   */
  const [search, setSearch] = useState('');

  /**
   * True while the user is dragging files over the window; shows the drop overlay.
   * @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]}
   */
  const [dragging, setDragging] = useState(false);

  /**
   * Id of the job currently being drag-reordered (null when idle). Drives the
   * DragOverlay preview while a queued job is lifted.
   * @type {[string | null, React.Dispatch<React.SetStateAction<string | null>>]}
   */
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  /**
   * dnd-kit sensors: a pointer sensor that needs a small move before a drag
   * starts (so card clicks still work), and a keyboard sensor with vertical-list
   * coordinate getter so sortable reordering stays keyboard accessible.
   */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 2 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * True while the main-process queue is paused (active conversions suspended,
   * queued jobs blocked). Mirrors the state the user toggles via BatchControls.
   * @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]}
   */
  const [paused, setPaused] = useState(false);

  /**
   * True while the Cancel All confirmation dialog is open; the destructive
   * queue-clear only runs after the user confirms.
   * @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]}
   */
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  /**
   * Optional output folder for newly added jobs. When empty, outputs are
   * written next to their source files (source-adjacent naming).
   * @type {[string, React.Dispatch<React.SetStateAction<string>>]}
   */
  const [outputDir, setOutputDir] = useState('');

  /**
   * Whether newly added jobs may replace existing output files. When false,
   * the main process rejects a job whose output already exists.
   * @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]}
   */
  const [overwrite, setOverwrite] = useState(false);

  /**
   * Files pending review in the add-files dialog, or null when the dialog is
   * closed. Setting an array opens the review dialog; confirming or cancelling
   * resets it to null.
   * @type {[string[] | null, React.Dispatch<React.SetStateAction<string[] | null>>]}
   */
  const [reviewFiles, setReviewFiles] = useState<string[] | null>(null);

  /**
   * Last-used batch encoding configuration read from localStorage once on
   * mount, used to seed every encoding `useState` below so the page restores
   * the previous session's settings.
   * @type {[BatchConfig, React.Dispatch<React.SetStateAction<BatchConfig>>]}
   */
  const [initialConfig] = useState<BatchConfig>(readStoredBatchConfig);

  /**
   * Video codec applied to jobs created under operations that keep video
   * ('transcode'); not part of the queued options otherwise. Selectable via the
   * encoding options panel.
   * @type {[string, React.Dispatch<React.SetStateAction<string>>]}
   */
  const [videoCodec, setVideoCodec] = useState(initialConfig.videoCodec);

  /**
   * Audio codec applied to jobs created under 'transcode' and 'extract_audio'
   * operations. Selectable via the encoding options panel.
   * @type {[string, React.Dispatch<React.SetStateAction<string>>]}
   */
  const [audioCodec, setAudioCodec] = useState(initialConfig.audioCodec);

  /**
   * Batch operation currently selected (one of BATCH_OPERATIONS values, e.g.
   * 'transcode', 'extract_audio', ...). Determines which codecs and encoding
   * controls are applied to the queued jobs.
   * @type {[string, React.Dispatch<React.SetStateAction<string>>]}
   */
  const [operation, setOperation] = useState<string>(initialConfig.operation);

  /**
   * Ref mirroring the current operation so the window drop handler, which is
   * registered once, always sees the latest value.
   * @type {React.MutableRefObject<string>}
   */
  const operationRef = useRef(operation);
  operationRef.current = operation;

  /**
   * Output container/extension applied to transcode and extract-audio jobs;
   * empty means the source file's extension is kept.
   * @type {[string, React.Dispatch<React.SetStateAction<string>>]}
   */
  const [container, setContainer] = useState(initialConfig.container);

  /**
   * Target video bitrate for transcode jobs (e.g. '2000k'); empty means the
   * encoder default is used.
   * @type {[string, React.Dispatch<React.SetStateAction<string>>]}
   */
  const [videoBitrate, setVideoBitrate] = useState(initialConfig.videoBitrate);

  /**
   * Target audio bitrate for transcode and extract-audio jobs (e.g. '192k');
   * empty means the encoder default is used.
   * @type {[string, React.Dispatch<React.SetStateAction<string>>]}
   */
  const [audioBitrate, setAudioBitrate] = useState(initialConfig.audioBitrate);

  /**
   * Image compression quality (qscale, 1-31) for compress_image jobs; empty
   * means the encoder default is used.
   * @type {[string, React.Dispatch<React.SetStateAction<string>>]}
   */
  const [quality, setQuality] = useState(initialConfig.quality);

  /**
   * Output resolution as WIDTHxHEIGHT for transcode and compress_image jobs;
   * empty keeps the source resolution.
   * @type {[string, React.Dispatch<React.SetStateAction<string>>]}
   */
  const [scale, setScale] = useState(initialConfig.scale);

  /**
   * Output pixel format (e.g. 'yuv420p') for transcode jobs.
   * @type {[string, React.Dispatch<React.SetStateAction<string>>]}
   */
  const [pixelFormat, setPixelFormat] = useState(initialConfig.pixelFormat);

  /**
   * Transcoder backend used for every job added from this page. Initialized to
   * the first entry of TRANSCODER_TYPES and selectable via BatchControls.
   * @type {React.MutableRefObject<string>}
   */
  const transcoderRef = useRef(TRANSCODER_TYPES[0]);

  /**
   * Suffix inserted into every generated output file name (e.g. `_converted`),
   * producing `name<suffix>.ext` next to the source file.
   * @type {React.MutableRefObject<string>}
   */
  const suffixRef = useRef<string>(DEFAULT_SUFFIX);

  /**
   * Ids of jobs observed in the RUNNING state during this page session; used to
   * determine which terminal (DONE/ERROR) transitions belong to the current run.
   * @type {React.MutableRefObject<Set<string>>}
   */
  const runningSeenRef = useRef<Set<string>>(new Set());

  /**
   * Jobs that transitioned RUNNING -> DONE/ERROR this session, mapped to their
   * outcome. Cleared after the batch-finished toast fires.
   * @type {React.MutableRefObject<Map<string, 'done' | 'error'>>}
   */
  const finishedRef = useRef<Map<string, 'done' | 'error'>>(new Map());

  /**
   * Number of RUNNING jobs in the previous render; used to detect the moment the
   * running count drops back to zero.
   * @type {React.MutableRefObject<number>}
   */
  const runningCountRef = useRef(0);

  /**
   * On mount, fetches the current job list from the main process and replaces
   * the store contents, so the page reflects jobs that existed before it was
   * opened.
   * @returns {void}
   */
  useEffect(() => {
    window.electronAPI?.queueList().then((jobs: QueueJob[]) => useQueueStore.getState().setJobs(jobs));
  }, []);

  /**
   * On mount, reads the queue's paused state from the main process so the
   * toolbar reflects a queue that was already paused before the page opened.
   * @returns {void}
   */
  useEffect(() => {
    window.electronAPI?.queueGetState().then((state: { paused: boolean }) => setPaused(state.paused));
  }, []);

  /**
   * Persists the current batch encoding configuration to localStorage whenever
   * any encoding control changes, so re-entering the page restores the last
   * session's settings.
   * @returns {void}
   */
  useEffect(() => {
    persistBatchConfig({ operation, videoCodec, audioCodec, container, videoBitrate, audioBitrate, quality, scale, pixelFormat });
  }, [operation, videoCodec, audioCodec, container, videoBitrate, audioBitrate, quality, scale, pixelFormat]);

  /**
   * On mount, pushes the persisted concurrency cap to the main process so the
   * queue processes at most that many jobs in parallel, and starts any jobs the
   * cap allows that were still queued from a previous session.
   * @returns {void}
   */
  useEffect(() => {
    window.electronAPI?.queueSetConcurrency(useSettingsStore.getState().queueConcurrency);
  }, []);

  /**
   * Subscribes to `onQueueAdded` events; each newly queued job is appended to
   * the store. Returns the unsubscribe function for cleanup.
   * @returns {() => void}
   */
  useEffect(() => {
    return window.electronAPI?.onQueueAdded(addJob);
  }, []);

  /**
   * Subscribes to `onQueueRemoved` events; the matching job is dropped from the
   * store by id. Returns the unsubscribe function for cleanup.
   * @returns {() => void}
   */
  useEffect(() => {
    return window.electronAPI?.onQueueRemoved((id: string) => removeJob(id));
  }, []);

  /**
   * Subscribes to `onQueueStatusChange` events; the job is replaced in the store
   * with its latest status/progress snapshot. Jobs that transition RUNNING to a
   * terminal state are tracked so the batch-finished toast can summarize the run.
   * Returns the unsubscribe function.
   * @returns {() => void}
   */
  useEffect(() => {
    return window.electronAPI?.onQueueStatusChange((job: QueueJob) => {
      if (job.status === QUEUE_STATUS.RUNNING) {
        runningSeenRef.current.add(job.id);
      } else if ((job.status === QUEUE_STATUS.DONE || job.status === QUEUE_STATUS.ERROR) && runningSeenRef.current.has(job.id)) {
        finishedRef.current.set(job.id, job.status === QUEUE_STATUS.DONE ? 'done' : 'error');
      }
      updateJob(job);
    });
  }, []);

  /**
   * Subscribes to `onQueueMoved` events and mirrors the main-process reorder in
   * the local store by repositioning the moved job within the QUEUED
   * subsequence (non-queued jobs keep their slots). Returns the unsubscribe.
   * @returns {() => void}
   */
  useEffect(() => {
    return window.electronAPI?.onQueueMoved(({ id, toPosition }) => {
      useQueueStore.setState((state) => {
        const jobs = reorderJob(state.jobs, id, toPosition);
        return jobs === state.jobs ? {} : { jobs };
      });
    });
  }, []);

  /**
   * When the running count drops from >0 to 0 and at least one job finished
   * during this session, shows a batch-completion toast summarizing the run and
   * raises a native OS notification with the same summary, then resets the
   * per-run tracking.
   * @returns {void}
   */
  useEffect(() => {
    const runningCount = jobs.filter((job: QueueJob) => job.status === QUEUE_STATUS.RUNNING).length;
    const wasRunning = runningCountRef.current > 0;
    runningCountRef.current = runningCount;
    if (wasRunning && runningCount === 0 && finishedRef.current.size > 0) {
      const outcomes = [...finishedRef.current.values()];
      const doneCount = outcomes.filter((outcome) => outcome === 'done').length;
      const failedCount = outcomes.filter((outcome) => outcome === 'error').length;
      const message = t('batchQueue.finished', { done: doneCount, failed: failedCount });
      useToastStore.getState().success(message);
      showNativeCompletionNotification(t('batchQueue.notificationTitle'), message);
      finishedRef.current.clear();
    }
  }, [jobs, t]);

  /**
   * Subscribes to `onQueueProgress` events; the job's live progress snapshot
   * (percent, time, fps, speed, eta, bitrate) is stored so running cards can
   * render captions. The job's percent is refreshed from the same payload.
   * Returns the unsubscribe function.
   * @returns {() => void}
   */
  useEffect(() => {
    return window.electronAPI?.onQueueProgress(({ job, progress }) => {
      updateJob(job);
      updateProgress(job.id, progress);
    });
  }, []);

  /**
   * Registers window-level drag listeners so files dropped anywhere on the page
   * are enqueued through the same path as the Add Files dialog. Shows a drop
   * overlay while dragging. Returns the cleanup that removes the listeners.
   * @returns {() => void}
   */
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setDragging(true);
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const paths: string[] = [];
      if (e.dataTransfer?.files) {
        for (const file of Array.from(e.dataTransfer.files)) {
          const path = window.electronAPI?.getPathForFile(file);
          if (path) paths.push(path);
        }
      }
      if (paths.length > 0) enqueueSelectionsRef.current(paths.map((path) => ({ file: path, operation: operationRef.current })));
    };
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  /**
   * Builds the queued ConversionOptions for a batch operation from the page's
   * encoding state and the hardware-acceleration settings. 'transcode' keeps
   * video and audio codecs plus video/audio bitrate, scale, and pixel format;
   * 'extract_audio' keeps only audio (with audio bitrate); 'compress_image'
   * keeps only image encoding (qscale and scale, no video/audio codecs).
   * @param {string} operation - The batch operation value.
   * @param {{hardwareAcceleration: boolean, hwaccelMode: HwAccelMode}} hw - Current
   *   hardware-acceleration settings.
   * @returns {Object} The options payload for the job.
   */
  const buildOptions = (
    operation: string,
    hw: { hardwareAcceleration: boolean; hwaccelMode: HwAccelMode },
  ): {
    videoCodec?: string;
    audioCodec?: string;
    videoBitrate?: string;
    audioBitrate?: string;
    qscale?: number;
    scale?: string;
    pixelFormat?: string;
    hardwareAcceleration: boolean;
    hwaccelMode: HwAccelMode;
  } => ({
    videoCodec: operation === 'transcode' ? videoCodec : undefined,
    audioCodec: operation === 'transcode' || operation === 'extract_audio' ? audioCodec : undefined,
    videoBitrate: operation === 'transcode' ? videoBitrate || undefined : undefined,
    audioBitrate: operation === 'transcode' || operation === 'extract_audio' ? audioBitrate || undefined : undefined,
    qscale: operation === 'compress_image' && quality ? Number(quality) : undefined,
    scale: operation === 'transcode' || operation === 'compress_image' ? scale || undefined : undefined,
    pixelFormat: operation === 'transcode' ? pixelFormat : undefined,
    hardwareAcceleration: hw.hardwareAcceleration,
    hwaccelMode: hw.hwaccelMode,
  });

  /**
   * Derives the output path for a source file: the configured output folder
   * (or the source's own directory), the source stem, the configured suffix,
   * and an extension chosen from the selected container, the audio codec's
   * suggested extension (extract-audio), the source extension, or the video
   * codec's suggested extension (transcode) as a last resort.
   * @param {string} file - Absolute path of the source file.
   * @param {string} operation - The batch operation value.
   * @param {string} sourceExt - Lowercased source extension ('' for dotfiles).
   * @returns {string} The output file path.
   */
  const buildOutputPath = (file: string, operation: string, sourceExt: string): string => {
    const sourceDir = outputDir.length > 0 ? outputDir.replace(/\\/g, '/').replace(/\/+$/, '') : getSourceDir(file).replace(/\\/g, '/');
    const stem = getSourceStem(file);
    let ext = container;
    if (!ext) {
      if (operation === 'extract_audio') ext = suggestedExtensionForAudioCodec(audioCodec) || sourceExt;
      else if (operation === 'transcode') ext = sourceExt || suggestedExtensionForVideoCodec(videoCodec);
      else ext = sourceExt;
    }
    if (!ext) ext = 'mp4';
    return `${sourceDir ? sourceDir + '/' : ''}${stem}${suffixRef.current}.${ext}`;
  };

  /**
   * Enqueues every given selection as a batch job using its per-file operation,
   * the shared suffix/transcoder/codec refs, and the hardware-acceleration
   * settings. The output path for each file is derived by inserting the
   * configured suffix before the chosen extension, inside the optional output
   * folder when one is set.
   *
   * Selections are validated and de-duplicated before any IPC call: files whose
   * extension does not fit their operation (images for compress-image,
   * non-images otherwise), files outside the supported media-extension set,
   * files whose input+output pair is already queued, and files whose computed
   * output path is already claimed by another queued or batched job are skipped
   * and reported by name in a single warning toast. Every successfully enqueued
   * file is summarized in one success toast instead of one toast per file.
   * @param {QueueAddReviewSelection[]} selections - One entry per source file
   *   with its chosen operation.
   * @returns {Promise<void>} Resolves once every enqueue request settled.
   */
  const enqueueSelections = async (selections: QueueAddReviewSelection[]) => {
    const { hardwareAcceleration, hwaccelMode } = useSettingsStore.getState();
    const currentJobs = useQueueStore.getState().jobs;
    const existingKeys = new Set(currentJobs.map((job: QueueJob) => `${normalizePath(job.input)}|${normalizePath(job.output)}`));
    const existingOutputs = new Set(currentJobs.map((job: QueueJob) => normalizePath(job.output)));
    const skippedNames: string[] = [];
    let added = 0;
    const enqueues: Promise<void>[] = [];
    for (const { file, operation } of selections) {
      const normalized = normalizePath(file);
      const expectsImage = operation === 'compress_image';
      const sourceExt = getSourceExtension(file);
      const isMedia = MEDIA_INPUT_EXTENSIONS.includes(sourceExt as (typeof MEDIA_INPUT_EXTENSIONS)[number]);
      if (expectsImage !== isImageFile(file) || !isMedia) {
        skippedNames.push(basename(file));
        continue;
      }
      const outFile = buildOutputPath(file, operation, sourceExt);
      const key = `${normalized}|${normalizePath(outFile)}`;
      if (existingKeys.has(key) || existingOutputs.has(normalizePath(outFile))) {
        skippedNames.push(basename(file));
        continue;
      }
      existingKeys.add(key);
      existingOutputs.add(normalizePath(outFile));
      const options = buildOptions(operation, { hardwareAcceleration, hwaccelMode });
      enqueues.push(
        window.electronAPI
          .queueAdd(file, outFile, options, transcoderRef.current, overwrite)
          .then(() => {
            added += 1;
          })
          .catch((err: unknown) => {
            useToastStore.getState().error(err instanceof Error ? err.message : String(err));
          }),
      );
    }
    await Promise.all(enqueues);
    if (added > 0) {
      useToastStore.getState().success(t('batchQueue.enqueued', { count: added }));
    }
    if (skippedNames.length > 0) {
      useToastStore.getState().warning(t('batchQueue.skippedDuplicates', { count: skippedNames.length, names: skippedNames.join(', ') }));
    }
  };

  /**
   * Latest `enqueueSelections` so window-level drag-and-drop listeners
   * (registered once on mount) always call the current closure.
   * @type {React.MutableRefObject<(selections: QueueAddReviewSelection[]) => void>}
   */
  const enqueueSelectionsRef = useRef(enqueueSelections);
  enqueueSelectionsRef.current = enqueueSelections;

  /**
   * Opens a multi-file selection dialog restricted to supported media
   * extensions; every chosen file is staged for the per-file review dialog
   * rather than enqueued immediately.
   * @returns {Promise<void>} Resolves once the file picker closes.
   */
  const handleAddFiles = async () => {
    const files = await window.electronAPI.selectFiles([
      { name: FILE_FILTERS.MEDIA_FILES.name, extensions: [...FILE_FILTERS.MEDIA_FILES.extensions] },
    ]);
    if (!files || files.length === 0) return;
    setReviewFiles(files);
  };

  /**
   * Enqueues the per-file selections confirmed in the review dialog, then closes
   * it.
   * @param {QueueAddReviewSelection[]} selections - One entry per file with its
   *   chosen operation.
   * @returns {void}
   */
  const handleReviewConfirm = (selections: QueueAddReviewSelection[]) => {
    enqueueSelections(selections);
    setReviewFiles(null);
  };

  /**
   * Closes the review dialog without enqueuing anything.
   * @returns {void}
   */
  const handleReviewCancel = () => {
    setReviewFiles(null);
  };

  /**
   * Re-enqueues a previously failed job with its original options, then drops
   * the errored entry from the queue so the retried job starts fresh. Failures
   * surface as an error toast instead of an unhandled rejection.
   * @param {QueueJob} failedJob - The errored job to retry.
   * @returns {Promise<void>} Resolves once the retry has been enqueued.
   */
  const handleRetry = async (failedJob: QueueJob) => {
    try {
      await window.electronAPI.queueAdd(failedJob.input, failedJob.output, failedJob.options, failedJob.transcoder, true);
      removeJob(failedJob.id);
      window.electronAPI.queueRemove(failedJob.id);
      useToastStore.getState().success(t('toast.jobAdded'));
    } catch (err) {
      useToastStore.getState().error(err instanceof Error ? err.message : String(err));
    }
  };

  /**
   * Opens a directory picker for the optional output folder. When a directory is
   * chosen, newly added jobs write their outputs into it.
   * @returns {Promise<void>} Resolves once the picker closes (null when cancelled).
   */
  const handleBrowseDir = async () => {
    const dir = await window.electronAPI.selectDirectory();
    if (dir) setOutputDir(dir);
  };

  /**
   * Opens the Cancel All confirmation dialog. The destructive queue clear is
   * deferred to `handleCancelAllConfirm`.
   * @returns {void}
   */
  const handleCancelAll = () => {
    setCancelConfirmOpen(true);
  };

  /**
   * Cancels every job in the queue via `window.electronAPI.queueCancelAll`
   * after the user confirmed the dialog, clears the local job list, and shows
   * an info toast.
   * @returns {Promise<void>} Resolves once the cancel request has been handled.
   */
  const handleCancelAllConfirm = async () => {
    setCancelConfirmOpen(false);
    await window.electronAPI.queueCancelAll();
    clearJobs();
    useToastStore.getState().info(t('toast.allCancelled'));
  };

  /**
   * Removes every done and errored job via `window.electronAPI.queueClearCompleted`
   * and prunes the local store to match. Queued and running jobs are untouched.
   * @returns {Promise<void>} Resolves once the completed jobs are dropped.
   */
  const handleClearCompleted = async () => {
    await window.electronAPI.queueClearCompleted();
    useQueueStore
      .getState()
      .jobs.filter((job: QueueJob) => job.status === QUEUE_STATUS.DONE || job.status === QUEUE_STATUS.ERROR)
      .forEach((job: QueueJob) => removeJob(job.id));
  };

  /**
   * Persists a new concurrency cap to settings and applies it to the main
   * process queue, which immediately starts as many queued jobs as the new cap
   * allows.
   * @param {number} concurrency - The parallel-job count (1-4).
   * @returns {void}
   */
  const handleConcurrencyChange = (concurrency: number) => {
    useSettingsStore.getState().setQueueConcurrency(concurrency);
  };

  /**
   * Applies a new batch operation and resets the container/format selection.
   * The container state has different semantics per operation (video/audio
   * containers vs image formats), so a stale value must not leak across
   * switches.
   * @param {string} value - The newly selected batch operation value.
   * @returns {void}
   */
  const handleOperationChange = (value: string) => {
    setOperation(value);
    setContainer('');
  };

  /**
   * Applies a new video codec selection and clears the chosen container when it
   * is no longer compatible with that codec, so jobs never mux into a container
   * the encoder cannot write.
   * @param {string} codec - The newly selected video encoder name.
   * @returns {void}
   */
  const handleVideoCodecChange = (codec: string) => {
    setVideoCodec(codec);
    if (container && !getVideoCodecContainer(codec).containers.includes(container)) {
      setContainer('');
    }
  };

  /**
   * Applies a new audio codec selection and clears the chosen container when it
   * is no longer compatible with that codec, so extract-audio jobs never mux
   * into a container the encoder cannot write.
   * @param {string} codec - The newly selected audio encoder name.
   * @returns {void}
   */
  const handleAudioCodecChange = (codec: string) => {
    setAudioCodec(codec);
    if (container && !getAudioCodecContainers(codec).includes(container)) {
      setContainer('');
    }
  };

  /**
   * Pauses the main-process queue (suspending active conversions and blocking
   * queued jobs) and reflects the paused state in the toolbar.
   * @returns {Promise<void>} Resolves once the pause request is handled.
   */
  const handlePause = async () => {
    await window.electronAPI.queuePause();
    setPaused(true);
  };

  /**
   * Resumes the main-process queue (resuming suspended conversions and starting
   * any queued jobs the concurrency cap allows) and clears the toolbar state.
   * @returns {Promise<void>} Resolves once the resume request is handled.
   */
  const handleResume = async () => {
    await window.electronAPI.queueResume();
    setPaused(false);
  };

  /**
   * Exports the current queue to a JSON file via the native save dialog. When
   * at least one job was written, shows a success toast; a cancelled dialog
   * (count 0) is silently ignored.
   * @returns {Promise<void>} Resolves once the export request is handled.
   */
  const handleExport = async () => {
    const count = await window.electronAPI.queueExport();
    if (count > 0) {
      useToastStore.getState().success(t('batchQueue.exported', { count }));
    }
  };

  /**
   * Imports jobs from a JSON queue file via the native open dialog. When at
   * least one job was enqueued, shows a success toast; a cancelled dialog
   * (count 0) is silently ignored, while a malformed or unreadable file
   * surfaces an error toast.
   * @returns {Promise<void>} Resolves once the import request is handled.
   */
  const handleImport = async () => {
    try {
      const count = await window.electronAPI.queueImport();
      if (count > 0) {
        useToastStore.getState().success(t('batchQueue.imported', { count }));
      }
    } catch (err) {
      useToastStore.getState().error(err instanceof Error ? err.message : String(err));
    }
  };

  const remainingSeconds = estimateRemaining(jobs, progress);

  /**
   * Jobs shown after applying the active status filter and search term. Their
   * order mirrors the store's queue order (filtering preserves relative order).
   * @type {QueueJob[]}
   */
  const visibleJobs = jobs
    .filter((job: QueueJob) => filter === 'all' || job.status === filter)
    .filter((job: QueueJob) => !search || basename(job.input).toLowerCase().includes(search.toLowerCase()));

  /**
   * Records which job is being dragged so the DragOverlay can preview it.
   * @param {DragStartEvent} event - The dnd-kit drag start event.
   * @returns {void}
   */
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  /**
   * Commits a drag-and-drop reorder: reorders the visible list, derives the
   * dragged job's target position within the QUEUED subsequence, applies it to
   * the store immediately (so the card snaps to its slot on release), and tells
   * the main process to commit it (`queueMoveTo`). The `onQueueMoved` echo is
   * an idempotent confirmation. Drops that land on the same card are no-ops.
   * @param {DragEndEvent} event - The dnd-kit drag end event.
   * @returns {void}
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    const visibleIds = visibleJobs.map((job: QueueJob) => job.id);
    const from = visibleIds.indexOf(activeId);
    const to = visibleIds.indexOf(overId);
    if (from === -1 || to === -1) return;
    const newVisibleIds = arrayMove(visibleIds, from, to);
    const toPosition = computeQueuedTargetPosition(jobs, activeId, newVisibleIds);
    useQueueStore.setState((state) => {
      const reordered = reorderJob(state.jobs, activeId, toPosition);
      return reordered === state.jobs ? {} : { jobs: reordered };
    });
    window.electronAPI.queueMoveTo(activeId, toPosition);
  };

  const activeJob = activeDragId ? jobs.find((job: QueueJob) => job.id === activeDragId) : null;

  return (
    <Box>
      <PageTitle variant="h5">
        <TitleIcon>{pageIcons['/batch']}</TitleIcon>
        {t('batchQueue.title')}
      </PageTitle>

      <Stack spacing={2}>
        <BatchControls
          operation={operation}
          onOperationChange={handleOperationChange}
          transcoderRef={transcoderRef}
          suffixRef={suffixRef}
          onAddFiles={handleAddFiles}
          onCancelAll={handleCancelAll}
          onClearCompleted={handleClearCompleted}
          hasCompleted={jobs.some((job: QueueJob) => job.status === QUEUE_STATUS.DONE || job.status === QUEUE_STATUS.ERROR)}
          concurrency={queueConcurrency}
          onConcurrencyChange={handleConcurrencyChange}
          paused={paused}
          onPause={handlePause}
          onResume={handleResume}
          hasActive={jobs.some((job: QueueJob) => job.status === QUEUE_STATUS.QUEUED || job.status === QUEUE_STATUS.RUNNING)}
          outputDir={outputDir}
          onOutputDirChange={setOutputDir}
          onBrowseDir={handleBrowseDir}
          overwrite={overwrite}
          onOverwriteChange={setOverwrite}
          onExport={handleExport}
          onImport={handleImport}
        />

        <BatchEncodingPanel
          operation={operation}
          videoCodec={videoCodec}
          audioCodec={audioCodec}
          container={container}
          videoBitrate={videoBitrate}
          audioBitrate={audioBitrate}
          quality={quality}
          scale={scale}
          pixelFormat={pixelFormat}
          onVideoCodecChange={handleVideoCodecChange}
          onAudioCodecChange={handleAudioCodecChange}
          onContainerChange={setContainer}
          onVideoBitrateChange={setVideoBitrate}
          onAudioBitrateChange={setAudioBitrate}
          onQualityChange={setQuality}
          onScaleChange={setScale}
          onPixelFormatChange={setPixelFormat}
        />

        {jobs.length > 0 && (
          <FilterRow>
            {['all', QUEUE_STATUS.QUEUED, QUEUE_STATUS.RUNNING, QUEUE_STATUS.DONE, QUEUE_STATUS.ERROR].map((value) => {
              const count = value === 'all' ? jobs.length : jobs.filter((job: QueueJob) => job.status === value).length;
              const labelKey = value === 'all' ? 'all' : value === QUEUE_STATUS.ERROR ? 'failed' : value;
              const label = t(`batchQueue.filters.${labelKey}`);
              return (
                <FilterChip
                  key={value}
                  size="small"
                  label={`${label} (${count})`}
                  color={filter === value ? 'primary' : 'default'}
                  onClick={() => setFilter(value)}
                />
              );
            })}
            <SearchField size="small" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('batchQueue.search')} />
            {remainingSeconds !== null && (
              <Typography variant="body2" color="text.secondary" sx={{ marginLeft: 'auto' }}>
                {t('batchQueue.etaEstimate', { eta: formatEstimate(remainingSeconds) })}
              </Typography>
            )}
          </FilterRow>
        )}
        {settingsHardwareAcceleration && <AccelAlert severity="info">{t('convert.hardwareAccelAlert')}</AccelAlert>}
        {jobs.length === 0 ? (
          <EmptyText color="text.secondary">{t('batchQueue.empty')}</EmptyText>
        ) : visibleJobs.length === 0 ? (
          <EmptyText color="text.secondary">{t('batchQueue.noResults')}</EmptyText>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveDragId(null)}
          >
            <SortableContext items={visibleJobs.map((job: QueueJob) => job.id)} strategy={verticalListSortingStrategy}>
              <Stack spacing={2}>
                {visibleJobs.map((job: QueueJob) => (
                  <QueueJobCard
                    key={job.id}
                    job={job}
                    progress={progress[job.id]}
                    onRemove={(id) => window.electronAPI.queueRemove(id)}
                    onRetry={handleRetry}
                  />
                ))}
              </Stack>
            </SortableContext>
            <DragOverlay
              dropAnimation={{
                duration: 200,
                easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
              }}
            >
              {activeJob && (
                <JobCard $status={activeJob.status} $dragOverlay variant="outlined">
                  <QueueJobCardContent job={activeJob} onRemove={() => {}} dragOverlay />
                </JobCard>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </Stack>

      {dragging && (
        <DropOverlay>
          <Typography variant="h6">{t('batchQueue.dropHint')}</Typography>
        </DropOverlay>
      )}

      <QueueAddReviewDialog
        open={reviewFiles !== null}
        files={reviewFiles ?? []}
        defaultOperation={operation}
        onConfirm={handleReviewConfirm}
        onCancel={handleReviewCancel}
      />

      <ConfirmDialog
        open={cancelConfirmOpen}
        title={t('batchQueue.cancelAllTitle')}
        message={t('batchQueue.cancelAllMessage')}
        confirmLabel={t('batchQueue.confirmCancelAll')}
        cancelLabel={t('batchQueue.dialogCancel')}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={handleCancelAllConfirm}
      />
    </Box>
  );
}
