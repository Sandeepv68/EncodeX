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
  audioCodec: 'libmp3lame',
  audioBitrate: BITRATE_OPTIONS[1],
  isConverting: false,
  isPaused: false,
  progress: null as TaskProgress | null,
};

export const useAudioExtractStore = create<AudioExtractState>((set, get) => ({
  ...INITIAL_STATE,
  setInput: (file) => {
    log.debug('setInput:', file);
    set({ input: file });
  },
  setPreview: (preview) => {
    log.debug('setPreview:', preview ? 'data-url' : 'null');
    set({ preview });
  },
  setAudioStreams: (streams) => {
    log.debug('setAudioStreams:', streams.length, 'streams');
    set({ audioStreams: streams });
  },
  setOutput: (output) => {
    log.debug('setOutput:', output);
    set({ output });
  },
  setAudioCodec: (codec) => {
    log.debug('setAudioCodec:', codec);
    set({ audioCodec: codec });
  },
  setAudioBitrate: (bitrate) => {
    log.debug('setAudioBitrate:', bitrate);
    set({ audioBitrate: bitrate });
  },
  setIsPaused: (v) => {
    log.debug('setIsPaused:', v);
    set({ isPaused: v });
  },
  setProgress: (p) => set({ progress: p }),
  clearSelection: () => {
    log.info('clearSelection');
    set({ input: '', preview: null, audioStreams: [], output: '' });
  },
  startExtract: async () => {
    const { input, output, audioCodec, audioBitrate } = get();
    if (!input) {
      log.warn('startExtract: no input file');
      useErrorStore.getState().showErrorMessage(ErrorCode.INPUT_NOT_SPECIFIED);
      return;
    }
    if (!output) {
      log.warn('startExtract: no output file');
      useErrorStore.getState().showErrorMessage(ErrorCode.OUTPUT_NOT_SPECIFIED);
      return;
    }
    log.info('startExtract:', input, '->', output, 'codec:', audioCodec);
    useErrorStore.getState().clearError();
    set({ isConverting: true, isPaused: false, progress: null });
    try {
      await window.electronAPI.convertFile(input, output, { audioCodec, audioBitrate }, TRANSCODER_TYPES[0]);
      log.info('Extraction completed successfully');
      useToastStore.getState().success(i18n.t('toast.audioExtracted'));
      set({ progress: null });
    } catch (err: unknown) {
      log.error('Extraction failed:', err);
      useErrorStore.getState().showError(err);
      set({ progress: null });
    } finally {
      set({ isConverting: false });
    }
  },
  pauseExtract: async () => {
    log.info('pauseExtract');
    await window.electronAPI.pauseConversion();
    set({ isPaused: true });
  },
  resumeExtract: async () => {
    log.info('resumeExtract');
    await window.electronAPI.resumeConversion();
    set({ isPaused: false });
  },
  cancelExtract: async () => {
    log.info('cancelExtract');
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
