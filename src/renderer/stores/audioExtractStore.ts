/**
 * @fileoverview Zustand store for audio extraction task state.
 * Manages audio extraction operation state and settings.
 */

import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { BITRATE_OPTIONS } from '../../shared/media-options';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import type { ConversionProgress, MediaStreamInfo } from '../../shared/types';
import { ErrorCode } from '../../shared/errors';
import { useErrorStore } from './errorStore';
import { useToastStore } from './toastStore';
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

const log = new Logger('renderer/stores/audioExtractStore');

export type TaskProgress = Pick<ConversionProgress, 'percent' | 'time' | 'speed' | 'eta'>;

interface AudioExtractState {
  input: string;
  preview: string | null;
  audioStreams: MediaStreamInfo[];
  output: string;
  audioCodec: string;
  audioBitrate: string;
  isConverting: boolean;
  isPaused: boolean;
  progress: TaskProgress | null;
  setInput: (file: string) => void;
  setPreview: (preview: string | null) => void;
  setAudioStreams: (streams: MediaStreamInfo[]) => void;
  setOutput: (output: string) => void;
  setAudioCodec: (codec: string) => void;
  setAudioBitrate: (bitrate: string) => void;
  setIsPaused: (v: boolean) => void;
  setProgress: (p: TaskProgress | null) => void;
  clearSelection: () => void;
  startExtract: () => Promise<void>;
  pauseExtract: () => Promise<void>;
  resumeExtract: () => Promise<void>;
  cancelExtract: () => Promise<void>;
}

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

export const useAudioExtractStore = create<AudioExtractState>((set, get) => ({
  ...INITIAL_STATE,
  setInput: (file) => {
    log.debug(LOG_SET_INPUT, file);
    set({ input: file });
  },
  setPreview: (preview) => {
    log.debug(LOG_SET_PREVIEW, preview ? 'data-url' : 'null');
    set({ preview });
  },
  setAudioStreams: (streams) => {
    log.debug(LOG_SET_AUDIO_STREAMS, streams.length, 'streams');
    set({ audioStreams: streams });
  },
  setOutput: (output) => {
    log.debug(LOG_SET_OUTPUT, output);
    set({ output });
  },
  setAudioCodec: (codec) => {
    log.debug(LOG_SET_AUDIO_CODEC, codec);
    set({ audioCodec: codec });
  },
  setAudioBitrate: (bitrate) => {
    log.debug(LOG_SET_AUDIO_BITRATE, bitrate);
    set({ audioBitrate: bitrate });
  },
  setIsPaused: (v) => {
    log.debug(LOG_SET_IS_PAUSED, v);
    set({ isPaused: v });
  },
  setProgress: (p) => set({ progress: p }),
  clearSelection: () => {
    log.info(LOG_CLEAR_SELECTION);
    set({ input: '', preview: null, audioStreams: [], output: '' });
  },
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
  pauseExtract: async () => {
    log.info(LOG_PAUSE_EXTRACT);
    await window.electronAPI.pauseConversion();
    set({ isPaused: true });
  },
  resumeExtract: async () => {
    log.info(LOG_RESUME_EXTRACT);
    await window.electronAPI.resumeConversion();
    set({ isPaused: false });
  },
  cancelExtract: async () => {
    log.info(LOG_CANCEL_EXTRACT);
    await window.electronAPI.cancelConversion();
    set({ isConverting: false, isPaused: false, progress: null });
  },
}));

window.electronAPI?.onConversionProgress((data: { input: string; output: string; progress: ConversionProgress }) => {
  const state = useAudioExtractStore.getState();
  if (!state.isConverting) return;
  const p = data.progress;
  useAudioExtractStore.getState().setProgress({ percent: p.percent, time: p.time, speed: p.speed, eta: p.eta });
});
