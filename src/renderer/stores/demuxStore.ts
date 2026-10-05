/**
 * @fileoverview Zustand store for demux task state.
 * Demux extracts *multiple* streams at once (one `convertFile` per selected
 * stream); this store owns the sequential runner and aggregates progress over
 * the individual targets.
 *
 * State held:
 *  - input / streams / selectedIndices / outputDir / targets / warnings / media:
 *    the demux form fields
 *  - isConverting / isPaused / progress / current: live operation state
 *
 * Consumers:
 *  - The Demux page UI components (renderer)
 *  - The useToastStore for success notifications and useErrorStore for errors
 *  - The analytics facade for demux_started / demux_completed / demux_failed
 *    lifecycle events (categorical counts only; no paths or identifiers)
 *
 * Behavior notes:
 *  - setInput probes the file via window.electronAPI.getMediaInfo (FFMPEG),
 *    selects every stream by default, and pre-generates the extraction targets
 *    into the input's directory.
 *  - Targets are always derived from the FULL probed stream list (so `-map`
 *    specs keep their per-kind ordinal even when intermediate streams are
 *    deselected) and then filtered to the selected indices.
 *  - startDemux runs each selected target sequentially via
 *    window.electronAPI.convertFile with the FFMPEG transcoder, aggregating
 *    per-target conversion progress into an overall percentage.
 *  - pause/resume/cancel delegate to window.electronAPI.pauseConversion /
 *    resumeConversion / cancelConversion.
 *  - A module-level window.electronAPI.onConversionProgress subscription
 *    (registered once at load) forwards progress events into the store only
 *    while isConverting is true. The subscription is not torn down when the
 *    store unmounts because the store is a module-level singleton.
 */

import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import type { ConversionProgress, MediaStreamInfo } from '../../shared/types';
import { toTaskProgress } from '../../shared/progress';
import { callBridgeVoid } from '../utils/bridge-call';
import { ErrorCode } from '../../shared/errors';
import {
  buildDemuxTargets,
  demuxWarnings,
  type DemuxMediaPreferences,
  type DemuxTarget,
  type RemuxWarning,
} from '../../shared/codec-containers';
import { useErrorStore } from './errorStore';
import { useToastStore } from './toastStore';
import { recordAnalyticsEvent } from '../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../shared/analytics/events';
import { demuxAnalyticsSummary } from '../../shared/analytics/analytics-summaries';
import type { DemuxState, TaskProgress } from './types';
import { dirname as pathDirname, stem as pathStem } from '../utils/path-utils';
import i18n from '../i18n/config';
import {
  LOG_ARROW,
  LOG_CANCEL_CONVERSION_CALLED,
  LOG_DEMUX_COMPLETE,
  LOG_DEMUX_CONVERT_KIND,
  LOG_DEMUX_FAILED,
  LOG_DEMUX_STREAM,
  LOG_FAILED_TO_GET_MEDIA_INFO,
  LOG_PAUSE_CONVERSION_CALLED,
  LOG_RESUME_CONVERSION_CALLED,
  LOG_SET_INPUT,
  LOG_START_CONVERSION_NO_INPUT_FILE,
  LOG_START_DEMUX,
} from '../../shared/log-constants';

/**
 * Per-store logger for the demux store.
 * @const {Logger} log
 */
const log = new Logger('renderer/stores/demuxStore');

/**
 * Disposition flag marking cover-art (attached picture) streams, which are
 * pictures rather than playable video and are skipped for demux.
 * @const {string} ATTACHED_PIC_DISPOSITION
 */
const ATTACHED_PIC_DISPOSITION = 'attached_pic';

/**
 * Joins a directory with a relative file name using the separator of the
 * directory (Windows `\` or POSIX `/`), stripping any trailing separator.
 * @param {string} dir - The output directory.
 * @param {string} name - The relative file name.
 * @returns {string} The joined absolute path.
 */
function joinPath(dir: string, name: string): string {
  const sep = dir.includes('\\') ? '\\' : '/';
  return `${dir.replace(/[\\/]+$/, '')}${sep}${name}`;
}

/**
 * Initial (and reset) values for the demux form and run state.
 * @const {Object} INITIAL_STATE
 * @property {string} input - Empty input path.
 * @property {MediaStreamInfo[]} streams - No probed streams.
 * @property {number[]} selectedIndices - No selected stream indices.
 * @property {string} outputDir - Empty output directory.
 * @property {DemuxTarget[]} targets - No extraction targets.
 * @property {RemuxWarning[]} warnings - No subtitle-conversion warnings.
 * @property {DemuxMediaPreferences} media - No conversion prefs (all copy).
 * @property {boolean} isConverting - Not converting.
 * @property {boolean} isPaused - Not paused.
 * @property {TaskProgress | null} progress - No progress.
 * @property {string | null} current - No active sub-task.
 */
const INITIAL_STATE = {
  input: '',
  streams: [] as MediaStreamInfo[],
  selectedIndices: [] as number[],
  outputDir: '',
  targets: [] as DemuxTarget[],
  warnings: [] as RemuxWarning[],
  media: {} as DemuxMediaPreferences,
  isConverting: false,
  isPaused: false,
  progress: null as TaskProgress | null,
  current: null as string | null,
};

/**
 * Module-level runner bookkeeping: whether a demux is running. The progress
 * subscription consults it (plus the store's isConverting flag) before
 * forwarding raw conversion progress into the store.
 * @type {boolean}
 */
let demuxActive = false;

/**
 * Builds the absolute output path for a target inside the output directory.
 * `buildDemuxTargets` returns file names relative to the source directory because
 * it does not know the target directory, so the store joins them here.
 * @param {string} outputDir - The output directory.
 * @param {string} name - Target-relative file name (e.g. 'movie.audio_0.m4a').
 * @returns {string} The absolute output path.
 */
function resolveTargetOutput(outputDir: string, name: string): string {
  return outputDir ? joinPath(outputDir, name) : name;
}

/**
 * Zustand store for demux task state.
 * Implemented as a module-level singleton so the React components and the
 * onConversionProgress IPC subscription can read the store outside of React via
 * useDemuxStore.getState().
 * @const {UseBoundStore<StoreApi<DemuxState>>} useDemuxStore
 */
export const useDemuxStore = create<DemuxState>((set, get) => ({
  ...INITIAL_STATE,
  /**
   * Probes the input file, selects all non-cover streams by default, and
   * pre-generates the extraction targets into the input's directory.
   * @param {string} file - Absolute path of the source media file.
   * @returns {Promise<void>} Resolves once the probe completes.
   */
  setInput: async (file) => {
    log.debug(LOG_SET_INPUT, file);
    try {
      const info = await window.electronAPI.getMediaInfo(file, TRANSCODER_TYPES[0]);
      const streams = (info.streams ?? []).filter((s) => !s.disposition?.includes(ATTACHED_PIC_DISPOSITION));
      const selectedIndices = streams.map((s) => s.index);
      const outputDir = pathDirname(file);
      const { targets, warnings } = buildTargets(file, streams, selectedIndices, get().media, outputDir);
      set({ input: file, streams, selectedIndices, outputDir, targets, warnings });
    } catch (err: unknown) {
      log.error(LOG_FAILED_TO_GET_MEDIA_INFO, err);
      useErrorStore.getState().showError(err);
    }
  },
  /**
   * Selects/deselects a probed stream and regenerates the extractable targets.
   * @param {number} index - Source stream (ffprobe global) index to toggle.
   */
  toggleStream: (index) => {
    const state = get();
    const selectedIndices = state.selectedIndices.includes(index)
      ? state.selectedIndices.filter((i) => i !== index)
      : [...state.selectedIndices, index].sort((a, b) => a - b);
    const { targets, warnings } = buildTargets(state.input, state.streams, selectedIndices, state.media, state.outputDir);
    set({ selectedIndices, targets, warnings });
  },
  /**
   * Sets the per-kind conversion preferences and regenerates the targets.
   * Any kind left unset falls back to lossless stream copy.
   * @param {DemuxMediaPreferences} media - Per-kind conversion targets.
   */
  setMedia: (media) => {
    const state = get();
    const { targets, warnings } = buildTargets(state.input, state.streams, state.selectedIndices, media, state.outputDir);
    set({ media, targets, warnings });
  },
  /**
   * Sets the output directory and regenerates the absolute target paths.
   * @param {string} dir - Absolute directory where extracted streams are written.
   */
  setOutputDir: (dir) => {
    const state = get();
    const { targets, warnings } = buildTargets(state.input, state.streams, state.selectedIndices, state.media, dir);
    set({ outputDir: dir, targets, warnings });
  },
  /**
   * Runs each selected target sequentially via window.electronAPI.convertFile,
   * aggregating per-target progress into an overall percentage. Aborts early
   * with a user-facing error when the input is missing or no stream is selected.
   * @returns {Promise<void>} Resolves when every target finishes or a target fails.
   */
  startDemux: async () => {
    const { input, targets } = get();
    if (!input) {
      log.warn(LOG_START_CONVERSION_NO_INPUT_FILE);
      useErrorStore.getState().showErrorMessage(ErrorCode.INPUT_NOT_SPECIFIED);
      return;
    }
    if (targets.length === 0) {
      useErrorStore.getState().showErrorMessage(ErrorCode.STREAM_NOT_FOUND);
      return;
    }
    log.info(LOG_START_DEMUX, input, LOG_ARROW, targets.length, 'targets');
    useErrorStore.getState().clearError();
    const summary = demuxAnalyticsSummary(targets);
    const demuxStartedAt = Date.now();
    recordAnalyticsEvent(createAnalyticsEvent('demux_started', summary));
    set({ isConverting: true, isPaused: false, progress: null, current: null });
    demuxActive = true;

    let completed = 0;
    let failed = false;
    for (const target of targets) {
      if (!get().isConverting) break;
      set({ current: `${target.kind}:${target.index}` });
      log.info(LOG_DEMUX_STREAM, target.kind, target.index, LOG_ARROW, target.output);
      log.info(LOG_DEMUX_CONVERT_KIND, target.copy ? 'copy' : 're-encode');
      try {
        await window.electronAPI.convertFile(input, target.output, optionsForTarget(target), TRANSCODER_TYPES[0]);
        completed += 1;
      } catch (err: unknown) {
        const code = typeof (err as { code?: string })?.code === 'string' ? (err as { code: string }).code : undefined;
        if (code === ErrorCode.CANCELLED) break;
        failed = true;
        recordAnalyticsEvent(createAnalyticsEvent('demux_failed', { ...summary, code }));
        log.error(LOG_DEMUX_FAILED, err);
        useErrorStore.getState().showError(err);
        break;
      }
    }

    if (failed) {
      demuxActive = false;
      set({ isConverting: false, progress: null, current: null });
      return;
    }

    demuxActive = false;
    set({ isConverting: false, current: null, progress: null });
    if (completed === targets.length) {
      log.info(LOG_DEMUX_COMPLETE, input, LOG_ARROW, targets.length, 'streams');
      recordAnalyticsEvent(
        createAnalyticsEvent('demux_completed', {
          ...summary,
          durationSec: Math.round((Date.now() - demuxStartedAt) / 1000),
        }),
      );
      useToastStore.getState().success(i18n.t('toast.demuxed'), undefined, undefined, {
        label: i18n.t('batchQueue.revealInFolder'),
        onClick: () => {
          const firstOutput = get().targets[0]?.output;
          if (firstOutput) void window.electronAPI.revealFile(firstOutput);
        },
      });
    }
  },
  /**
   * Pauses the running demux via window.electronAPI.pauseConversion().
   * @returns {Promise<void>} Resolves once the main process confirms the pause.
   */
  pause: async () => {
    log.info(LOG_PAUSE_CONVERSION_CALLED);
    await window.electronAPI.pauseConversion();
    set({ isPaused: true });
  },
  /**
   * Resumes the demux via window.electronAPI.resumeConversion().
   * @returns {Promise<void>} Resolves once the main process confirms the resume.
   */
  resume: async () => {
    log.info(LOG_RESUME_CONVERSION_CALLED);
    await window.electronAPI.resumeConversion();
    set({ isPaused: false });
  },
  /**
   * Cancels the demux via window.electronAPI.cancelConversion() and resets the
   * sequential runner and run state.
   * @returns {Promise<void>} Resolves once the main process confirms the cancel.
   */
  cancel: async () => {
    log.info(LOG_CANCEL_CONVERSION_CALLED);
    demuxActive = false;
    set({ isConverting: false });
    await window.electronAPI.cancelConversion();
    set({ isPaused: false, progress: null, current: null });
  },
  /**
   * Clears the input, streams, selection, targets, and output directory.
   * Keeps the per-kind conversion preferences and run state untouched.
   */
  clearSelection: () => {
    set({ input: '', streams: [], selectedIndices: [], outputDir: '', targets: [], warnings: [], current: null });
  },
  /**
   * Sets the live aggregated demux progress (or null to clear it).
   * @param {TaskProgress | null} p - Progress data, or null when idle/complete.
   */
  setProgress: (p) => set({ progress: p }),
}));

/**
 * Builds the extraction targets for the currently selected streams, deriving
 * the `-map` specs against the FULL (non-cover) stream list so per-kind
 * ordinals always match the source file even when intermediate same-kind
 * streams are deselected, then filtering to the selection and joining the
 * output directory.
 * @param {string} input - Absolute path of the source file.
 * @param {MediaStreamInfo[]} streams - All probed non-cover streams.
 * @param {number[]} selectedIndices - Source stream indices selected for extraction.
 * @param {DemuxMediaPreferences} media - Per-kind conversion preferences.
 * @param {string} outputDir - Absolute output directory.
 * @returns {DemuxTarget[]} Extraction targets for the selected streams.
 */
function buildTargets(
  input: string,
  streams: MediaStreamInfo[],
  selectedIndices: number[],
  media: DemuxMediaPreferences,
  outputDir: string,
): { targets: DemuxTarget[]; warnings: RemuxWarning[] } {
  if (!input || streams.length === 0) return { targets: [], warnings: [] };
  const baseName = pathStem(input);
  const fullTargets = buildDemuxTargets(input, baseName, streams, media);
  const selected = new Set(selectedIndices);
  const targets = fullTargets.filter((t) => selected.has(t.index)).map((t) => ({ ...t, output: resolveTargetOutput(outputDir, t.output) }));
  const selectedStreams = streams.filter((s) => selected.has(s.index));
  const warnings = demuxWarnings(selectedStreams, media);
  return { targets, warnings };
}

/**
 * Composes the `ConversionOptions` for a single demux target: stream-copy by
 * default, per-kind encoder when converting, `-vn`/`-an` guards so only the
 * mapped stream kind is written, and the video filter chain when the target
 * re-encodes video.
 * @param {DemuxTarget} target - The extraction target.
 * @returns {Record<string, unknown>} Ready-to-run conversion options.
 */
function optionsForTarget(target: DemuxTarget): Record<string, unknown> {
  const opts: Record<string, unknown> = { copy: target.copy, map: [target.map] };
  if (target.kind === 'video') {
    opts.video = true;
    opts.audio = false;
    if (!target.copy && target.codec) opts.videoCodec = target.codec;
    if (target.videoFilters?.length) opts.videoFilters = target.videoFilters;
  } else if (target.kind === 'audio') {
    opts.video = false;
    opts.audio = true;
    if (!target.copy && target.codec) opts.audioCodec = target.codec;
  } else {
    opts.video = false;
    opts.audio = false;
    if (!target.copy && target.codec) opts.subtitleCodec = target.codec;
  }
  return opts;
}

/**
 * IPC subscription that forwards conversion progress events into the store.
 * Registered once at module load via window.electronAPI.onConversionProgress.
 * The callback ignores events while no demux is running (guarded by
 * state.isConverting) and otherwise maps the raw ConversionProgress payload into
 * a TaskProgress, weighting the running target equally among all active targets
 * so the reported percentage is the overall demux progress. Because the store
 * is a module-level singleton, the subscription is never unsubscribed.
 * @type {void}
 */
callBridgeVoid(() => {
  window.electronAPI?.onConversionProgress((data: { input: string; output: string; progress: ConversionProgress }) => {
    const state = useDemuxStore.getState();
    if (!demuxActive || !state.isConverting) return;
    const total = state.targets.length;
    if (total === 0) return;
    const idx = state.targets.findIndex((t) => t.output === data.output);
    if (idx < 0) return;
    const perTarget = 100 / total;
    const overall = Math.round(idx * perTarget + (data.progress.percent * perTarget) / 100);
    useDemuxStore.getState().setProgress({ ...toTaskProgress(data.progress), percent: overall });
  });
}, 'demux conversion progress subscription');
