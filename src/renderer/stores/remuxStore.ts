/**
 * @fileoverview Zustand store for remux task state.
 * Manages the remux form (input file, target container, probed source streams,
 * selected `-map` specs, added subtitle/audio/cover assets, chapters file,
 * audio sync) together with the live warnings and run state
 * (isConverting, isPaused, progress) of the remux operation.
 *
 * State held:
 *  - input / container / streams / selectedMaps / addedSubtitles / addedAudio /
 *    thumbnail / chaptersFile / copyChapters / audioSyncSeconds / videoFilters /
 *    output: the remux form fields
 *  - warnings: live non-blocking container-compatibility findings
 *  - isConverting / isPaused / progress: live operation state
 *
 * Consumers:
 *  - The Remux page UI components (renderer)
 *  - The useToastStore for success notifications and useErrorStore for errors
 *
 * Behavior notes:
 *  - setInput probes the file via window.electronAPI.getMediaInfo (FFMPEG) and
 *    auto-suggests an output path (withExtension(input, container)).
 *  - startRemux validates input/output presence, builds the plan through
 *    buildAndValidateRemuxPlan (which raises INCOMPATIBLE_CONTAINER on hard
 *    incompatibilities), then runs window.electronAPI.convertFile with the
 *    FFMPEG transcoder.
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
import type { ConversionProgress, MediaStreamInfo, RemuxInput } from '../../shared/types';
import { toTaskProgress } from '../../shared/progress';
import { callBridgeVoid } from '../utils/bridge-call';
import { ErrorCode } from '../../shared/errors';
import { withExtension, remuxWarnings } from '../../shared/codec-containers';
import { buildAndValidateRemuxPlan, buildPrimaryStreamMaps } from '../../shared/remux-utils';
import { useErrorStore } from './errorStore';
import { useToastStore } from './toastStore';
import type { RemuxState, TaskProgress } from './types';
import i18n from '../i18n/config';
import { recordAnalyticsEvent } from '../../shared/analytics/AnalyticsService';
import { createAnalyticsEvent } from '../../shared/analytics/events';
import {
  LOG_ARROW,
  LOG_CANCEL_CONVERSION_CALLED,
  LOG_CLEAR_SELECTION,
  LOG_FAILED_TO_GET_MEDIA_INFO,
  LOG_PAUSE_CONVERSION_CALLED,
  LOG_REMUX_COMPLETE,
  LOG_REMUX_FAILED,
  LOG_RESUME_CONVERSION_CALLED,
  LOG_SET_INPUT,
  LOG_SET_OUTPUT,
  LOG_START_REMUX,
  LOG_START_REMUX_NO_INPUT_FILE,
  LOG_START_REMUX_NO_OUTPUT_FILE,
} from '../../shared/log-constants';

/**
 * Per-store logger for the remux store.
 * @const {Logger} log
 */
const log = new Logger('renderer/stores/remuxStore');

/**
 * Default target container for a remux.
 * @const {string} DEFAULT_REMUX_CONTAINER
 */
const DEFAULT_REMUX_CONTAINER = 'mkv';

/**
 * Initial (and reset) values for the remux form and run state.
 * @const {Object} INITIAL_STATE
 * @property {string} input - Empty input path.
 * @property {string} container - DEFAULT_REMUX_CONTAINER.
 * @property {MediaStreamInfo[]} streams - No probed streams.
 * @property {string[]} selectedMaps - No `-map` specs.
 * @property {RemuxInput[]} addedSubtitles - No added subtitle tracks.
 * @property {RemuxInput[]} addedAudio - No added audio tracks.
 * @property {RemuxInput | null} thumbnail - No cover art.
 * @property {string | null} chaptersFile - No chapters file.
 * @property {boolean} copyChapters - Source chapters are preserved.
 * @property {number | null} audioSyncSeconds - No audio delay.
 * @property {string[]} videoFilters - No video filters (empty = lossless copy).
 * @property {string} output - Empty output path.
 * @property {never[]} warnings - No warnings.
 * @property {boolean} isDirty - No user edits yet.
 * @property {boolean} isConverting - Not converting.
 * @property {boolean} isPaused - Not paused.
 * @property {TaskProgress | null} progress - No progress.
 */
const INITIAL_STATE = {
  input: '',
  container: DEFAULT_REMUX_CONTAINER,
  streams: [] as MediaStreamInfo[],
  selectedMaps: [] as string[],
  addedSubtitles: [] as RemuxInput[],
  addedAudio: [] as RemuxInput[],
  addedAudioInfo: [] as MediaStreamInfo[],
  thumbnail: null as RemuxInput | null,
  chaptersFile: null as string | null,
  copyChapters: true,
  audioSyncSeconds: null as number | null,
  videoFilters: [] as string[],
  output: '',
  warnings: [] as ReturnType<typeof remuxWarnings>,
  isDirty: false,
  isConverting: false,
  isPaused: false,
  progress: null as TaskProgress | null,
};

/**
 * Builds the ordered `-map` specs for the primary input from the probed
 * source streams via the shared {@link buildPrimaryStreamMaps} helper, so the
 * GUI default selection matches the CLI/MCP one exactly.
 * @param {MediaStreamInfo[]} streams - Probed source streams.
 * @returns {string[]} `-map` specs for the primary input, in stream order.
 */
function buildStreamMaps(streams: MediaStreamInfo[]): string[] {
  return buildPrimaryStreamMaps(streams);
}

/**
 * Recomputes the non-blocking remux warnings for the current form state.
 * @param {RemuxState} state - Current store state snapshot.
 * @returns {ReturnType<typeof remuxWarnings>} Ordered findings.
 */
function computeWarnings(state: RemuxState): ReturnType<typeof remuxWarnings> {
  const additionalInputs = [...state.addedSubtitles, ...state.addedAudio];
  if (state.thumbnail) additionalInputs.push(state.thumbnail);
  return remuxWarnings(state.streams, additionalInputs, state.chaptersFile ?? undefined, state.container, state.videoFilters);
}

/**
 * Zustand store for remux task state.
 * Implemented as a module-level singleton so the React components and the
 * onConversionProgress IPC subscription can read the store outside of React via
 * useRemuxStore.getState().
 * @const {UseBoundStore<StoreApi<RemuxState>>} useRemuxStore
 */
export const useRemuxStore = create<RemuxState>((set, get) => ({
  ...INITIAL_STATE,
  /**
   * Probes the input file, populates the source streams, selects all non-cover
   * streams by default, and auto-suggests the output path.
   * @param {string} file - Absolute path of the source media file.
   * @returns {Promise<void>} Resolves once the probe completes.
   */
  setInput: async (file) => {
    log.debug(LOG_SET_INPUT, file);
    try {
      const info = await window.electronAPI.getMediaInfo(file, TRANSCODER_TYPES[0]);
      const streams = info.streams ?? [];
      const selectedMaps = buildStreamMaps(streams);
      const container = get().container;
      set({
        input: file,
        streams,
        selectedMaps,
        output: withExtension(file, container),
        isDirty: true,
        warnings: computeWarnings({ ...get(), streams, selectedMaps }),
      });
    } catch (err: unknown) {
      log.error(LOG_FAILED_TO_GET_MEDIA_INFO, err);
      useErrorStore.getState().showError(err);
    }
  },
  /**
   * Sets the target container and recomputes the compatibility warnings.
   * Re-suggests the output extension only when the output still matches the
   * previously auto-suggested path (so manual overrides are preserved).
   * @param {string} container - Target container extension (e.g. 'mkv').
   */
  setContainer: (container) => {
    const state = get();
    const previous = state.container;
    const previousOutput = withExtension(state.input, previous);
    const output = state.output === previousOutput ? withExtension(state.input, container) : state.output;
    const next: Partial<RemuxState> = { container, output, isDirty: true };
    next.warnings = computeWarnings({ ...state, container });
    set(next);
  },
  /**
   * Adds or removes a `-map` spec from the primary-input selection, then
   * recomputes warnings (subtitle selection affects compatibility findings).
   * @param {string} map - The `-map` spec to toggle (e.g. '0:a:0').
   */
  toggleStream: (map) => {
    const state = get();
    const exists = state.selectedMaps.includes(map);
    const selectedMaps = exists ? state.selectedMaps.filter((m) => m !== map) : [...state.selectedMaps, map];
    set({ selectedMaps, isDirty: true, warnings: computeWarnings({ ...state, selectedMaps }) });
  },
  /**
   * Selects every non-cover source stream (when `selected` is true) or clears
   * the entire selection, recreating the ordered `-map` specs and recomputing
   * the compatibility warnings.
   * @param {boolean} selected - True to select all source streams, false to keep none.
   */
  setAllStreamsSelected: (selected) => {
    const state = get();
    const selectedMaps = selected ? buildStreamMaps(state.streams) : [];
    set({ selectedMaps, isDirty: true, warnings: computeWarnings({ ...state, selectedMaps }) });
  },
  /**
   * Adds an external subtitle track for embedding into the output.
   * @param {RemuxInput} input - The subtitle file composed as an additional input.
   */
  addSubtitleFile: (input) => {
    const state = get();
    const addedSubtitles = [...state.addedSubtitles, input];
    set({ addedSubtitles, isDirty: true, warnings: computeWarnings({ ...state, addedSubtitles }) });
  },
  /**
   * Adds an external audio track for embedding into the output. The optional
   * probed stream info is kept in a parallel array (`addedAudioInfo`) so the UI
   * can render the track's codec/channels/language next to the entry.
   * @param {RemuxInput} input - The audio file composed as an additional input.
   * @param {MediaStreamInfo} [info] - Probed info of the track's stream 0.
   */
  addAudioFile: (input, info) => {
    const state = get();
    set({
      addedAudio: [...state.addedAudio, input],
      addedAudioInfo: info ? [...state.addedAudioInfo, info] : state.addedAudioInfo,
      isDirty: true,
      warnings: computeWarnings({ ...state, addedAudio: [...state.addedAudio, input] }),
    });
  },
  /**
   * Removes a previously added subtitle/audio track by its position in the
   * combined added-stream list (subtitles first, then audio).
   * @param {number} index - Index within [...addedSubtitles, ...addedAudio].
   */
  removeAddedStream: (index) => {
    const state = get();
    const addedSubtitles = [...state.addedSubtitles];
    const addedAudio = [...state.addedAudio];
    const addedAudioInfo = [...state.addedAudioInfo];
    if (index < 0 || index >= addedSubtitles.length + addedAudio.length) return;
    if (index < addedSubtitles.length) addedSubtitles.splice(index, 1);
    else {
      const audioIndex = index - addedSubtitles.length;
      addedAudio.splice(audioIndex, 1);
      addedAudioInfo.splice(audioIndex, 1);
    }
    set({ addedSubtitles, addedAudio, addedAudioInfo, isDirty: true, warnings: computeWarnings({ ...state, addedSubtitles, addedAudio }) });
  },
  /**
   * Sets the per-entry sync offset of an added subtitle/audio track.
   * @param {number} index - Index within [...addedSubtitles, ...addedAudio].
   * @param {number} seconds - Signed offset seconds (positive = plays later).
   */
  setAddedStreamSync: (index, seconds) => {
    const state = get();
    const addedSubtitles = state.addedSubtitles.map((entry, i) => (i === index ? { ...entry, syncOffsetSeconds: seconds } : entry));
    const audioIndex = index - state.addedSubtitles.length;
    const addedAudio =
      audioIndex >= 0
        ? state.addedAudio.map((entry, i) => (i === audioIndex ? { ...entry, syncOffsetSeconds: seconds } : entry))
        : state.addedAudio;
    set({ addedSubtitles, addedAudio, isDirty: true });
  },
  /**
   * Sets the target codec of an added subtitle/audio track. Changing the codec
   * may flip the container-compatibility warning (e.g. `mov_text` is accepted
   * by MP4 while `ass` is not), so warnings are recomputed.
   * @param {number} index - Index within [...addedSubtitles, ...addedAudio].
   * @param {string} codec - Target codec, e.g. 'copy', 'subrip', 'mov_text'.
   */
  setAddedStreamCodec: (index, codec) => {
    const state = get();
    const addedSubtitles = state.addedSubtitles.map((entry, i) => (i === index ? { ...entry, codec } : entry));
    const audioIndex = index - state.addedSubtitles.length;
    const addedAudio =
      audioIndex >= 0 ? state.addedAudio.map((entry, i) => (i === audioIndex ? { ...entry, codec } : entry)) : state.addedAudio;
    set({
      addedSubtitles,
      addedAudio,
      isDirty: true,
      warnings: computeWarnings({ ...state, addedSubtitles, addedAudio }),
    });
  },
  /**
   * Sets the primary audio delay via the lossless re-read trick.
   * @param {number | null} seconds - Signed seconds to shift primary audio, or null to clear.
   */
  setAudioSync: (seconds) => set({ audioSyncSeconds: seconds, isDirty: true }),
  /**
   * Sets or clears the cover-art input.
   * @param {RemuxInput | null} input - The cover image composed as an input, or null.
   */
  setThumbnail: (input) => {
    const state = get();
    const thumbnail = input;
    set({ thumbnail, isDirty: true, warnings: computeWarnings({ ...state, thumbnail }) });
  },
  /**
   * Sets or clears the FFMETADATA chapters file.
   * @param {string | null} file - Absolute path of the chapters file, or null.
   */
  setChaptersFile: (file) => {
    const state = get();
    const chaptersFile = file;
    set({ chaptersFile, isDirty: true, warnings: computeWarnings({ ...state, chaptersFile }) });
  },
  /**
   * Sets whether source chapters are preserved in the output.
   * @param {boolean} v - True to copy source chapters.
   */
  setCopyChapters: (v) => set({ copyChapters: v, isDirty: true }),
  /**
   * Replaces the ordered video filter chain. Any non-empty chain turns the
   * remux into a re-encode (filters cannot be applied to a stream copy) and
   * refreshes the warnings so the page shows the re-encode notice.
   * @param {string[]} filters - Ordered filter expressions (empty = lossless copy).
   */
  setVideoFilters: (filters) => {
    const state = get();
    const videoFilters = [...filters];
    set({ videoFilters, isDirty: true, warnings: computeWarnings({ ...state, videoFilters }) });
  },
  /**
   * Sets the output file path.
   * @param {string} output - Absolute path where the remuxed file will be written.
   */
  setOutput: (output) => {
    log.debug(LOG_SET_OUTPUT, output);
    set({ output, isDirty: true });
  },
  /**
   * Sets the live remux progress (or null to clear it).
   * @param {TaskProgress | null} p - Progress data, or null when idle/complete.
   */
  setProgress: (p) => set({ progress: p }),
  /**
   * Validates and starts a remux.
   * Aborts early with a user-facing error when the input or output is missing
   * (ErrorCode.INPUT_NOT_SPECIFIED / OUTPUT_NOT_SPECIFIED). Builds the
   * ConversionOptions via buildAndValidateRemuxPlan (surfacing any hard
   * INCOMPATIBLE_CONTAINER error; storing non-blocking warnings), then calls
   * window.electronAPI.convertFile(input, output, plan.options,
   * TRANSCODER_TYPES[0]) — i.e. the FFMPEG backend. On success shows the
   * 'toast.remuxed' toast; on failure surfaces the error via the error store.
   * isConverting is always cleared in a finally block.
   * @returns {Promise<void>} Resolves when the remux finishes or fails.
   */
  startRemux: async () => {
    const state = get();
    const { input, output, container } = state;
    if (!input) {
      log.warn(LOG_START_REMUX_NO_INPUT_FILE);
      useErrorStore.getState().showErrorMessage(ErrorCode.INPUT_NOT_SPECIFIED);
      return;
    }
    if (!output) {
      log.warn(LOG_START_REMUX_NO_OUTPUT_FILE);
      useErrorStore.getState().showErrorMessage(ErrorCode.OUTPUT_NOT_SPECIFIED);
      return;
    }
    log.info(LOG_START_REMUX, input, LOG_ARROW, output, 'container', container);
    useErrorStore.getState().clearError();

    const additionalInputs = [...state.addedSubtitles, ...state.addedAudio];
    if (state.thumbnail) additionalInputs.push(state.thumbnail);

    let options;
    try {
      const plan = buildAndValidateRemuxPlan(
        {
          input,
          container,
          maps: state.selectedMaps,
          additionalInputs,
          chaptersFile: state.chaptersFile ?? undefined,
          copyChapters: state.copyChapters,
          audioSyncSeconds: state.audioSyncSeconds ?? undefined,
          videoFilters: state.videoFilters,
        },
        state.streams,
      );
      options = plan.options;
      set({ warnings: plan.warnings as ReturnType<typeof remuxWarnings> });
    } catch (err: unknown) {
      useErrorStore.getState().showError(err);
      return;
    }

    set({ isConverting: true, isPaused: false, progress: null });
    const remuxStartedAt = Date.now();
    recordAnalyticsEvent(
      createAnalyticsEvent('remux_started', {
        container,
        streamCount: state.selectedMaps.length,
        addedSubs: state.addedSubtitles.length,
        addedAudio: state.addedAudio.length,
        hasThumbnail: state.thumbnail !== null,
        hasChapters: state.chaptersFile !== null || state.copyChapters === true,
        hasAudioSync: state.audioSyncSeconds !== null,
      }),
    );
    try {
      await window.electronAPI.convertFile(input, output, options, TRANSCODER_TYPES[0]);
      log.info(LOG_REMUX_COMPLETE, input, LOG_ARROW, output);
      recordAnalyticsEvent(
        createAnalyticsEvent('remux_completed', {
          container,
          streamCount: state.selectedMaps.length,
          addedSubs: state.addedSubtitles.length,
          addedAudio: state.addedAudio.length,
          hasThumbnail: state.thumbnail !== null,
          hasChapters: state.chaptersFile !== null || state.copyChapters === true,
          hasAudioSync: state.audioSyncSeconds !== null,
          durationSec: Math.round((Date.now() - remuxStartedAt) / 1000),
        }),
      );
      useToastStore.getState().success(i18n.t('toast.remuxed'), undefined, undefined, {
        label: i18n.t('batchQueue.revealInFolder'),
        onClick: () => {
          void window.electronAPI.revealFile(output);
        },
      });
      set({ progress: null });
    } catch (err: unknown) {
      log.error(LOG_REMUX_FAILED, err);
      const code = typeof (err as { code?: string })?.code === 'string' ? (err as { code: string }).code : undefined;
      if (code !== ErrorCode.CANCELLED) {
        recordAnalyticsEvent(createAnalyticsEvent('remux_failed', { container, code }));
      }
      useErrorStore.getState().showError(err);
      set({ progress: null });
    } finally {
      set({ isConverting: false });
    }
  },
  /**
   * Pauses the running remux via window.electronAPI.pauseConversion().
   * @returns {Promise<void>} Resolves once the main process confirms the pause.
   */
  pause: async () => {
    log.info(LOG_PAUSE_CONVERSION_CALLED);
    await window.electronAPI.pauseConversion();
    set({ isPaused: true });
  },
  /**
   * Resumes the remux via window.electronAPI.resumeConversion().
   * @returns {Promise<void>} Resolves once the main process confirms the resume.
   */
  resume: async () => {
    log.info(LOG_RESUME_CONVERSION_CALLED);
    await window.electronAPI.resumeConversion();
    set({ isPaused: false });
  },
  /**
   * Cancels the remux via window.electronAPI.cancelConversion() and resets
   * isConverting, isPaused, and progress.
   * @returns {Promise<void>} Resolves once the main process confirms the cancel.
   */
  cancel: async () => {
    log.info(LOG_CANCEL_CONVERSION_CALLED);
    await window.electronAPI.cancelConversion();
    set({ isConverting: false, isPaused: false, progress: null });
  },
  /**
   * Clears the input, streams, maps, outputs, and added assets.
   * Resets the dirty flag so the form no longer counts as pending work.
   * Keeps the target container, video filters, and run state untouched.
   */
  clearSelection: () => {
    log.info(LOG_CLEAR_SELECTION);
    const container = get().container;
    const videoFilters = get().videoFilters;
    set({
      input: '',
      streams: [],
      selectedMaps: [],
      addedSubtitles: [],
      addedAudio: [],
      addedAudioInfo: [],
      thumbnail: null,
      chaptersFile: null,
      copyChapters: true,
      audioSyncSeconds: null,
      videoFilters,
      output: '',
      warnings: [],
      isDirty: false,
      container,
    });
  },
}));

/**
 * IPC subscription that forwards conversion progress events into the store.
 * Registered once at module load via window.electronAPI.onConversionProgress.
 * The callback ignores events while no remux is running (guarded by
 * state.isConverting) and otherwise maps the raw ConversionProgress payload into
 * a TaskProgress before calling setProgress. Because the store is a module-level
 * singleton, the subscription is never unsubscribed (there is no off() call).
 * @type {void}
 */
callBridgeVoid(() => {
  window.electronAPI?.onConversionProgress((data: { input: string; output: string; progress: ConversionProgress }) => {
    const state = useRemuxStore.getState();
    if (!state.isConverting) return;
    useRemuxStore.getState().setProgress(toTaskProgress(data.progress));
  });
}, 'remux conversion progress subscription');
