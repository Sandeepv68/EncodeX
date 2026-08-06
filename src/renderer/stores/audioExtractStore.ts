/**
 * @fileoverview Zustand store for audio extraction task state.
 * Manages the audio extraction form (input file, preview, detected audio
 * streams, output file) and its codec/bitrate settings, together with the live
 * run state (isConverting, isPaused, progress) of the extraction operation.
 *
 * State held:
 *  - input / preview / audioStreams / output: the extraction form fields
 *  - audioCodec / audioBitrate: encoding settings
 *  - isConverting / isPaused / progress: live operation state
 *
 * Consumers:
 *  - AudioExtractPanel and related audio-extraction UI components (renderer)
 *  - The useToastStore for success notifications and useErrorStore for errors
 *
 * Behavior notes:
 *  - startExtract validates that input and output are present, surfacing
 *    ErrorCode.INPUT_NOT_SPECIFIED / OUTPUT_NOT_SPECIFIED otherwise, then runs
 *    window.electronAPI.convertFile with the FFMPEG transcoder.
 *  - pause/resume/cancel delegate to window.electronAPI.pauseConversion /
 *    resumeConversion / cancelConversion.
 *  - A module-level window.electronAPI.onConversionProgress subscription
 *    (registered once at load) forwards progress events into the store only
 *    while isConverting is true. The subscription is not torn down when the
 *    store unmounts because the store is a module-level singleton.
 */

import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { BITRATE_OPTIONS } from '../../shared/media-options';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import type { ConversionProgress, MediaStreamInfo } from '../../shared/types';
import { ErrorCode } from '../../shared/errors';
import { useErrorStore } from './errorStore';
import { useToastStore } from './toastStore';
import type { AudioExtractState, TaskProgress } from './types';
import i18n from '../i18n/config';
import { AUDIO_EXTRACT_DEFAULT_CODEC } from '../../shared/constants';
import {
  LOG_ARROW,
  LOG_CANCEL_EXTRACT,
  LOG_CLEAR_SELECTION,
  LOG_CODEC,
  LOG_EXTRACTION_COMPLETED_SUCCESSFULLY,
  LOG_EXTRACTION_FAILED,
  LOG_PAUSE_EXTRACT,
  LOG_RESUME_EXTRACT,
  LOG_SET_AUDIO_BITRATE,
  LOG_SET_AUDIO_CODEC,
  LOG_SET_AUDIO_STREAMS,
  LOG_SET_INPUT,
  LOG_SET_IS_PAUSED,
  LOG_SET_OUTPUT,
  LOG_SET_PREVIEW,
  LOG_START_EXTRACT,
  LOG_START_EXTRACT_NO_INPUT_FILE,
  LOG_START_EXTRACT_NO_OUTPUT_FILE,
} from '../../shared/log-constants';

/**
 * Per-store logger for the audio extraction store.
 * @const {Logger} log
 */
const log = new Logger('renderer/stores/audioExtractStore');

/**
 * Initial (and reset) values for the audio extraction form and run state.
 * audioBitrate defaults to BITRATE_OPTIONS[1] ('192k').
 * @const {Object} INITIAL_STATE
 * @property {string} input - Empty input path.
 * @property {string | null} preview - No preview.
 * @property {MediaStreamInfo[]} audioStreams - No detected streams.
 * @property {string} output - Empty output path.
 * @property {string} audioCodec - AUDIO_EXTRACT_DEFAULT_CODEC ('libmp3lame').
 * @property {string} audioBitrate - BITRATE_OPTIONS[1] ('192k').
 * @property {boolean} isConverting - Not converting.
 * @property {boolean} isPaused - Not paused.
 * @property {TaskProgress | null} progress - No progress.
 */
const INITIAL_STATE = {
  input: '',
  preview: null as string | null,
  audioStreams: [] as MediaStreamInfo[],
  output: '',
  audioCodec: AUDIO_EXTRACT_DEFAULT_CODEC,
  audioBitrate: BITRATE_OPTIONS[1],
  isConverting: false,
  isPaused: false,
  progress: null as TaskProgress | null,
};

/**
 * Zustand store for audio extraction task state.
 * Implemented as a module-level singleton so the React components and the
 * onConversionProgress IPC subscription can read the store outside of React via
 * useAudioExtractStore.getState().
 * @const {UseBoundStore<StoreApi<AudioExtractState>>} useAudioExtractStore
 */
export const useAudioExtractStore = create<AudioExtractState>((set, get) => ({
  ...INITIAL_STATE,
  /**
   * Sets the input file path.
   * @param {string} file - Absolute path of the input media file.
   */
  setInput: (file) => {
    log.debug(LOG_SET_INPUT, file);
    set({ input: file });
  },
  /**
   * Sets the preview data URL, or clears it when null.
   * @param {string | null} preview - Data URL of the preview image/frame, or null.
   */
  setPreview: (preview) => {
    log.debug(LOG_SET_PREVIEW, preview ? 'data-url' : 'null');
    set({ preview });
  },
  /**
   * Sets the audio streams detected in the input file.
   * @param {MediaStreamInfo[]} streams - Detected audio stream descriptors.
   */
  setAudioStreams: (streams) => {
    log.debug(LOG_SET_AUDIO_STREAMS, streams.length, 'streams');
    set({ audioStreams: streams });
  },
  /**
   * Sets the output file path.
   * @param {string} output - Absolute path where the extracted audio will be written.
   */
  setOutput: (output) => {
    log.debug(LOG_SET_OUTPUT, output);
    set({ output });
  },
  /**
   * Sets the audio encoder used for extraction.
   * @param {string} codec - Audio encoder name (e.g. 'libmp3lame').
   */
  setAudioCodec: (codec) => {
    log.debug(LOG_SET_AUDIO_CODEC, codec);
    set({ audioCodec: codec });
  },
  /**
   * Sets the target audio bitrate.
   * @param {string} bitrate - Bitrate string (e.g. '192k' or 'lossless').
   */
  setAudioBitrate: (bitrate) => {
    log.debug(LOG_SET_AUDIO_BITRATE, bitrate);
    set({ audioBitrate: bitrate });
  },
  /**
   * Sets whether the extraction is paused.
   * @param {boolean} v - True when the extraction is paused.
   */
  setIsPaused: (v) => {
    log.debug(LOG_SET_IS_PAUSED, v);
    set({ isPaused: v });
  },
  /**
   * Sets the live extraction progress (or null to clear it).
   * @param {TaskProgress | null} p - Progress data, or null when idle/complete.
   */
  setProgress: (p) => set({ progress: p }),
  /**
   * Clears the input, preview, audio streams, and output fields.
   * Keeps the codec/bitrate settings and run state untouched.
   */
  clearSelection: () => {
    log.info(LOG_CLEAR_SELECTION);
    set({ input: '', preview: null, audioStreams: [], output: '' });
  },
  /**
   * Validates and starts an audio extraction.
   * Aborts early with a user-facing error when the input or output is missing
   * (ErrorCode.INPUT_NOT_SPECIFIED / OUTPUT_NOT_SPECIFIED). Otherwise clears any
   * existing error, resets progress, and calls
   * window.electronAPI.convertFile(input, output, { audioCodec, audioBitrate },
   * TRANSCODER_TYPES[0]) — i.e. the FFMPEG backend. On success shows the
   * 'toast.audioExtracted' toast; on failure surfaces the error via the error
   * store. isConverting is always cleared in a finally block.
   * @returns {Promise<void>} Resolves when the extraction finishes or fails.
   */
  startExtract: async () => {
    const { input, output, audioCodec, audioBitrate } = get();
    if (!input) {
      log.warn(LOG_START_EXTRACT_NO_INPUT_FILE);
      useErrorStore.getState().showErrorMessage(ErrorCode.INPUT_NOT_SPECIFIED);
      return;
    }
    if (!output) {
      log.warn(LOG_START_EXTRACT_NO_OUTPUT_FILE);
      useErrorStore.getState().showErrorMessage(ErrorCode.OUTPUT_NOT_SPECIFIED);
      return;
    }
    log.info(LOG_START_EXTRACT, input, LOG_ARROW, output, LOG_CODEC, audioCodec);
    useErrorStore.getState().clearError();
    set({ isConverting: true, isPaused: false, progress: null });
    try {
      await window.electronAPI.convertFile(input, output, { audioCodec, audioBitrate }, TRANSCODER_TYPES[0]);
      log.info(LOG_EXTRACTION_COMPLETED_SUCCESSFULLY);
      useToastStore.getState().success(i18n.t('toast.audioExtracted'));
      set({ progress: null });
    } catch (err: unknown) {
      log.error(LOG_EXTRACTION_FAILED, err);
      useErrorStore.getState().showError(err);
      set({ progress: null });
    } finally {
      set({ isConverting: false });
    }
  },
  /**
   * Pauses the running extraction via window.electronAPI.pauseConversion().
   * @returns {Promise<void>} Resolves once the main process confirms the pause.
   */
  pauseExtract: async () => {
    log.info(LOG_PAUSE_EXTRACT);
    await window.electronAPI.pauseConversion();
    set({ isPaused: true });
  },
  /**
   * Resumes the extraction via window.electronAPI.resumeConversion().
   * @returns {Promise<void>} Resolves once the main process confirms the resume.
   */
  resumeExtract: async () => {
    log.info(LOG_RESUME_EXTRACT);
    await window.electronAPI.resumeConversion();
    set({ isPaused: false });
  },
  /**
   * Cancels the extraction via window.electronAPI.cancelConversion() and resets
   * isConverting, isPaused, and progress.
   * @returns {Promise<void>} Resolves once the main process confirms the cancel.
   */
  cancelExtract: async () => {
    log.info(LOG_CANCEL_EXTRACT);
    await window.electronAPI.cancelConversion();
    set({ isConverting: false, isPaused: false, progress: null });
  },
}));

/**
 * IPC subscription that forwards conversion progress events into the store.
 * Registered once at module load via window.electronAPI.onConversionProgress.
 * The callback ignores events while no extraction is running (guarded by
 * state.isConverting) and otherwise maps the raw ConversionProgress payload into
 * a TaskProgress before calling setProgress. Because the store is a module-level
 * singleton, the subscription is never unsubscribed (there is no off() call).
 * @type {void}
 */
window.electronAPI?.onConversionProgress((data: { input: string; output: string; progress: ConversionProgress }) => {
  const state = useAudioExtractStore.getState();
  if (!state.isConverting) return;
  const p = data.progress;
  useAudioExtractStore.getState().setProgress({ percent: p.percent, time: p.time, speed: p.speed, eta: p.eta });
});
