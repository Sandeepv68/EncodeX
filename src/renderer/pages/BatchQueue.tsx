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
 * `onQueueAdded`, `onQueueRemoved`, and `onQueueStatusChange`, which feed the
 * `useQueueStore` zustand store.
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Stack } from '@mui/material';
import BatchControls from '../components/BatchControls';
import QueueJobCard from '../components/QueueJobCard';
import { useQueueStore } from '../stores/queueStore';
import { useToastStore } from '../stores/toastStore';
import { BATCH_OPERATIONS, DEFAULT_SUFFIX } from '../../shared/media-options';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import { QueueJob } from '../../shared/types';
import { useSettingsStore } from '../stores/settingsStore';
import { PageTitle, QueuePaper, EmptyText } from '../styles/BatchQueue.styles';
import { TitleIcon } from '../styles/PageContainer.styles';
import { pageIcons } from '../pageIcons';

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
 *  - `queueList()` / `onQueueAdded` / `onQueueRemoved` / `onQueueStatusChange` -
 *    keep the in-memory job list in sync with the main process.
 *
 * @returns {JSX.Element} The page content.
 */
export default function BatchQueue() {
  const { t } = useTranslation();
  const { jobs, addJob, removeJob, updateJob, clearJobs } = useQueueStore();

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
   * On mount, fetches the current job list from the main process and replaces
   * the store contents, so the page reflects jobs that existed before it was
   * opened.
   * @returns {void}
   */
  useEffect(() => {
    window.electronAPI?.queueList().then((jobs: QueueJob[]) => useQueueStore.getState().setJobs(jobs));
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
   * with its latest status/progress snapshot. Returns the unsubscribe function.
   * @returns {() => void}
   */
  useEffect(() => {
    return window.electronAPI?.onQueueStatusChange(updateJob);
  }, []);

  /**
   * Opens a multi-file selection dialog and enqueues every chosen file as a
   * batch job. The output path for each file is derived by inserting the
   * configured suffix before the original extension. Options are built from the
   * active operation: 'transcode' and 'extract_audio' set an audio codec,
   * 'transcode' also sets a video codec, and other operations omit codecs. The
   * global hardware-acceleration and hwaccel-mode settings are read from
   * `useSettingsStore`. A success toast is shown per enqueued file.
   * @returns {Promise<void>} Resolves once all selected files are enqueued.
   */
  const handleAddFiles = async () => {
    const files = await window.electronAPI.selectFiles();
    if (!files) return;
    const { hardwareAcceleration, hwaccelMode } = useSettingsStore.getState();
    for (const file of files) {
      const ext = file.split('.').pop();
      const outFile = `${file.substring(0, file.lastIndexOf('.'))}${suffixRef.current}.${ext}`;
      window.electronAPI.queueAdd(
        file,
        outFile,
        {
          videoCodec: operationRef.current === 'extract_audio' ? undefined : videoCodecRef.current,
          audioCodec:
            operationRef.current === 'transcode'
              ? audioCodecRef.current
              : operationRef.current === 'extract_audio'
                ? audioCodecRef.current
                : undefined,
          hardwareAcceleration,
          hwaccelMode,
        },
        transcoderRef.current,
      );
      useToastStore.getState().success(t('toast.jobAdded'));
    }
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
      />

      <QueuePaper>
        {jobs.length === 0 ? (
          <EmptyText color="text.secondary">{t('batchQueue.empty')}</EmptyText>
        ) : (
          <Stack spacing={1}>
            {jobs.map((job: QueueJob) => (
              <QueueJobCard key={job.id} job={job} onRemove={(id) => window.electronAPI.queueRemove(id)} />
            ))}
          </Stack>
        )}
      </QueuePaper>
    </Box>
  );
}
