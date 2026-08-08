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
import { Box, Chip, Stack, TextField, Typography } from '@mui/material';
import BatchControls from '../components/BatchControls';
import QueueJobCard from '../components/QueueJobCard';
import QueueAddReviewDialog from '../components/QueueAddReviewDialog';
import { useQueueStore } from '../stores/queueStore';
import { useToastStore } from '../stores/toastStore';
import { BATCH_OPERATIONS, DEFAULT_SUFFIX, QUEUE_STATUS } from '../../shared/media-options';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import { isImageFile } from '../../shared/file-extensions';
import { estimateRemaining, formatEstimate } from '../../shared/estimate';
import { QueueJob } from '../../shared/types';
import { useSettingsStore } from '../stores/settingsStore';
import type { QueueAddReviewSelection } from '../components/types';
import { PageTitle, QueuePaper, EmptyText, FilterRow, DropOverlay } from '../styles/BatchQueue.styles';
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
 * Normalizes a file path for duplicate comparison: lowercases and unifies
 * Windows backslashes with POSIX forward slashes.
 * @param {string} path - The file path to normalize.
 * @returns {string} The normalized path.
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase();
}

/**
 * Renders the batch conversion queue page (`/batch`).
 *
 * Holds the batch configuration in refs (`videoCodec`, `audioCodec`,
 * `transcoder`, `operation`, `suffix`) that are bound to `BatchControls`, so
 * its inputs never trigger re-renders on every change. The visible job list is
 * read from `useQueueStore`.
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
 *  - `queueMove(id, direction)` - reorder a queued job (via QueueJobCard arrows).
 *  - `queueList()` / `onQueueAdded` / `onQueueRemoved` / `onQueueStatusChange` /
 *    `onQueueMoved` - keep the in-memory job list in sync with the main process.
 *
 * @returns {JSX.Element} The page content.
 */
export default function BatchQueue() {
  const { t } = useTranslation();
  const { jobs, progress, addJob, removeJob, updateJob, updateProgress, clearJobs } = useQueueStore();
  const queueConcurrency = useSettingsStore((s) => s.queueConcurrency);

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
   * True while the main-process queue is paused (active conversions suspended,
   * queued jobs blocked). Mirrors the state the user toggles via BatchControls.
   * @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]}
   */
  const [paused, setPaused] = useState(false);

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
   * Video codec applied to jobs created under operations that keep video
   * ('transcode' and 'extract_audio'); not part of the queued options otherwise.
   * @type {React.MutableRefObject<string>}
   */
  const videoCodecRef = useRef('libx264');

  /**
   * Audio codec applied to jobs created under 'transcode' and 'extract_audio'
   * operations.
   * @type {React.MutableRefObject<string>}
   */
  const audioCodecRef = useRef('aac');

  /**
   * Transcoder backend used for every job added from this page. Initialized to
   * the first entry of TRANSCODER_TYPES and selectable via BatchControls.
   * @type {React.MutableRefObject<string>}
   */
  const transcoderRef = useRef(TRANSCODER_TYPES[0]);

  /**
   * Batch operation currently selected (one of BATCH_OPERATIONS values, e.g.
   * 'transcode', 'copy', 'extract_audio', ...). Determines which codecs are
   * included in the queued options.
   * @type {React.MutableRefObject<string>}
   */
  const operationRef = useRef<string>(BATCH_OPERATIONS[0].value);

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
   * the local store by swapping the moved job with its adjacent QUEUED
   * neighbour (non-queued jobs keep their slots). Returns the unsubscribe.
   * @returns {() => void}
   */
  useEffect(() => {
    return window.electronAPI?.onQueueMoved(({ id, direction }) => {
      useQueueStore.setState((state) => {
        const queuedIndexes = state.jobs
          .map((job: QueueJob, index: number) => (job.status === QUEUE_STATUS.QUEUED ? index : -1))
          .filter((index: number) => index !== -1);
        const currentPos = queuedIndexes.findIndex((index: number) => state.jobs[index].id === id);
        if (currentPos === -1) return {};
        const targetPos = currentPos + direction;
        if (targetPos < 0 || targetPos >= queuedIndexes.length) return {};
        const jobs = [...state.jobs];
        const from = queuedIndexes[currentPos];
        const to = queuedIndexes[targetPos];
        const moved = jobs[from];
        jobs[from] = jobs[to];
        jobs[to] = moved;
        return { jobs };
      });
    });
  }, []);

  /**
   * When the running count drops from >0 to 0 and at least one job finished
   * during this session, shows a batch-completion toast summarizing the run,
   * then resets the per-run tracking.
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
      useToastStore.getState().success(t('batchQueue.finished', { done: doneCount, failed: failedCount }));
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
   * codec refs and the hardware-acceleration settings. 'transcode' keeps video
   * and audio codecs; 'extract_audio' keeps only audio; 'compress_image' keeps
   * only video.
   * @param {string} operation - The batch operation value.
   * @param {{hardwareAcceleration: boolean, hwaccelMode: string}} hw - Current
   *   hardware-acceleration settings.
   * @returns {{videoCodec?: string, audioCodec?: string, hardwareAcceleration: boolean, hwaccelMode: string}}
   *   The options payload for the job.
   */
  const buildOptions = (
    operation: string,
    hw: { hardwareAcceleration: boolean; hwaccelMode: string },
  ): {
    videoCodec?: string;
    audioCodec?: string;
    hardwareAcceleration: boolean;
    hwaccelMode: string;
  } => ({
    videoCodec: operation === 'extract_audio' ? undefined : videoCodecRef.current,
    audioCodec: operation === 'transcode' || operation === 'extract_audio' ? audioCodecRef.current : undefined,
    hardwareAcceleration: hw.hardwareAcceleration,
    hwaccelMode: hw.hwaccelMode,
  });

  /**
   * Enqueues every given selection as a batch job using its per-file operation,
   * the shared suffix/transcoder/codec refs, and the hardware-acceleration
   * settings. The output path for each file is derived by inserting the
   * configured suffix before the original extension, inside the optional output
   * folder when one is set. A success toast is shown per enqueued file. Files
   * whose extension does not fit their operation (images for compress-image,
   * non-images otherwise) and files already present in the queue are skipped
   * and reported in a single warning toast.
   * @param {QueueAddReviewSelection[]} selections - One entry per source file
   *   with its chosen operation.
   * @returns {void}
   */
  const enqueueSelections = (selections: QueueAddReviewSelection[]) => {
    const { hardwareAcceleration, hwaccelMode } = useSettingsStore.getState();
    const queuedInputs = new Set(useQueueStore.getState().jobs.map((job: QueueJob) => normalizePath(job.input)));
    let skipped = 0;
    for (const { file, operation } of selections) {
      const normalized = normalizePath(file);
      const expectsImage = operation === 'compress_image';
      if (expectsImage !== isImageFile(file) || queuedInputs.has(normalized)) {
        skipped += 1;
        continue;
      }
      queuedInputs.add(normalized);
      const ext = file.split('.').pop();
      const outFile =
        outputDir.length > 0
          ? `${outputDir.replace(/\\/g, '/').replace(/\/+$/, '')}/${basename(file.substring(0, file.lastIndexOf('.')))}${suffixRef.current}.${ext}`
          : `${file.substring(0, file.lastIndexOf('.'))}${suffixRef.current}.${ext}`;
      window.electronAPI
        .queueAdd(file, outFile, buildOptions(operation, { hardwareAcceleration, hwaccelMode }), transcoderRef.current, overwrite)
        .then(() => {
          useToastStore.getState().success(t('toast.jobAdded'));
        })
        .catch((err: unknown) => {
          useToastStore.getState().error(err instanceof Error ? err.message : String(err));
        });
    }
    if (skipped > 0) {
      useToastStore.getState().warning(t('batchQueue.skippedDuplicates', { count: skipped }));
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
   * Opens a multi-file selection dialog; every chosen file is staged for the
   * per-file review dialog rather than enqueued immediately.
   * @returns {Promise<void>} Resolves once the file picker closes.
   */
  const handleAddFiles = async () => {
    const files = await window.electronAPI.selectFiles();
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
   * the errored entry from the queue so the retried job starts fresh.
   * @param {QueueJob} failedJob - The errored job to retry.
   * @returns {Promise<void>} Resolves once the retry has been enqueued.
   */
  const handleRetry = async (failedJob: QueueJob) => {
    await window.electronAPI.queueAdd(failedJob.input, failedJob.output, failedJob.options, failedJob.transcoder, true);
    removeJob(failedJob.id);
    window.electronAPI.queueRemove(failedJob.id);
    useToastStore.getState().success(t('toast.jobAdded'));
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
   * Cancels every job in the queue via `window.electronAPI.queueCancelAll`,
   * clears the local job list, and shows an info toast.
   * @returns {Promise<void>} Resolves once the cancel request has been handled.
   */
  const handleCancelAll = async () => {
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

  return (
    <Box>
      <PageTitle variant="h5">
        <TitleIcon>{pageIcons['/batch']}</TitleIcon>
        {t('batchQueue.title')}
      </PageTitle>
      <BatchControls
        operationRef={operationRef}
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

      {jobs.length > 0 && (
        <FilterRow>
          {['all', QUEUE_STATUS.QUEUED, QUEUE_STATUS.RUNNING, QUEUE_STATUS.DONE, QUEUE_STATUS.ERROR].map((value) => {
            const count = value === 'all' ? jobs.length : jobs.filter((job: QueueJob) => job.status === value).length;
            const labelKey = value === 'all' ? 'all' : value === QUEUE_STATUS.ERROR ? 'failed' : value;
            const label = t(`batchQueue.filters.${labelKey}`);
            return (
              <Chip
                key={value}
                size="small"
                label={`${label} (${count})`}
                color={filter === value ? 'primary' : 'default'}
                onClick={() => setFilter(value)}
              />
            );
          })}
          <TextField size="small" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('batchQueue.search')} />
          {remainingSeconds !== null && (
            <Typography variant="body2" color="text.secondary" sx={{ marginLeft: 'auto' }}>
              {t('batchQueue.etaEstimate', { eta: formatEstimate(remainingSeconds) })}
            </Typography>
          )}
        </FilterRow>
      )}

      <QueuePaper>
        {jobs.length === 0 ? (
          <EmptyText color="text.secondary">{t('batchQueue.empty')}</EmptyText>
        ) : (
          <Stack spacing={1}>
            {jobs
              .filter((job: QueueJob) => filter === 'all' || job.status === filter)
              .filter((job: QueueJob) => !search || basename(job.input).toLowerCase().includes(search.toLowerCase()))
              .map((job: QueueJob) => (
                <QueueJobCard
                  key={job.id}
                  job={job}
                  progress={progress[job.id]}
                  onRemove={(id) => window.electronAPI.queueRemove(id)}
                  onRetry={handleRetry}
                  onMove={(id, direction) => window.electronAPI.queueMove(id, direction)}
                />
              ))}
          </Stack>
        )}
      </QueuePaper>

      {dragging && (
        <DropOverlay>
          <Typography variant="h6">{t('batchQueue.dropHint')}</Typography>
        </DropOverlay>
      )}

      <QueueAddReviewDialog
        open={reviewFiles !== null}
        files={reviewFiles ?? []}
        defaultOperation={operationRef.current}
        onConfirm={handleReviewConfirm}
        onCancel={handleReviewCancel}
      />
    </Box>
  );
}
