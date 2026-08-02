import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { CONVERSION_DEFAULTS, TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import { ENCODER_TYPE_DEFAULT } from '../../shared/hwaccel-settings';
import type { EncoderType } from '../../shared/hwaccel-settings';

const log = new Logger('renderer/stores/conversionStore');

interface ProgressData {
  percent: number;
  time: string;
  speed: string;
  eta: string;
}

interface ConversionState {
  inputFile: string | null;
  outputFile: string | null;
  outputUserSet: boolean;
  videoCodec: string;
  audioCodec: string;
  videoBitrate: string;
  audioBitrate: string;
  qscale: number;
  scale: string;
  pixelFormat: string;
  copyMode: boolean;
  transcoder: string;
  encoderType: EncoderType;
  isConverting: boolean;
  isPaused: boolean;
  isDirty: boolean;
  progress: ProgressData | null;
  setInputFile: (file: string | null) => void;
  setOutputFile: (file: string | null) => void;
  setOutputAuto: (file: string | null) => void;
  setVideoCodec: (codec: string) => void;
  setAudioCodec: (codec: string) => void;
  setVideoBitrate: (bitrate: string) => void;
  setAudioBitrate: (bitrate: string) => void;
  setQscale: (q: number) => void;
  setScale: (s: string) => void;
  setPixelFormat: (f: string) => void;
  setCopyMode: (c: boolean) => void;
  setTranscoder: (t: string) => void;
  setEncoderType: (type: EncoderType) => void;
  setIsConverting: (v: boolean) => void;
  setIsPaused: (v: boolean) => void;
  setProgress: (p: ProgressData | null) => void;
  resetForm: () => void;
}

const INITIAL_STATE = {
  inputFile: null as string | null,
  outputFile: null as string | null,
  outputUserSet: false,
  videoCodec: CONVERSION_DEFAULTS.VIDEO_CODEC,
  audioCodec: CONVERSION_DEFAULTS.AUDIO_CODEC,
  videoBitrate: CONVERSION_DEFAULTS.VIDEO_BITRATE,
  audioBitrate: CONVERSION_DEFAULTS.AUDIO_BITRATE,
  qscale: CONVERSION_DEFAULTS.QSCALE,
  scale: CONVERSION_DEFAULTS.SCALE,
  pixelFormat: CONVERSION_DEFAULTS.PIXEL_FORMAT,
  copyMode: false,
  transcoder: TRANSCODER_TYPES[0],
  encoderType: ENCODER_TYPE_DEFAULT,
  isConverting: false,
  isPaused: false,
  isDirty: false,
  progress: null,
};

export const useConversionStore = create<ConversionState>((set) => ({
  ...INITIAL_STATE,
  setInputFile: (file) => {
    log.debug('setInputFile:', file);
    set({ inputFile: file, isDirty: true });
  },
  setOutputFile: (file) => {
    log.debug('setOutputFile:', file);
    set({ outputFile: file, outputUserSet: true, isDirty: true });
  },
  setOutputAuto: (file) => {
    log.debug('setOutputAuto:', file);
    set({ outputFile: file, isDirty: true });
  },
  setVideoCodec: (codec) => {
    log.debug('setVideoCodec:', codec);
    set({ videoCodec: codec, isDirty: true });
  },
  setAudioCodec: (codec) => {
    log.debug('setAudioCodec:', codec);
    set({ audioCodec: codec, isDirty: true });
  },
  setVideoBitrate: (bitrate) => {
    log.debug('setVideoBitrate:', bitrate);
    set({ videoBitrate: bitrate, isDirty: true });
  },
  setAudioBitrate: (bitrate) => {
    log.debug('setAudioBitrate:', bitrate);
    set({ audioBitrate: bitrate, isDirty: true });
  },
  setQscale: (q) => {
    log.debug('setQscale:', q);
    set({ qscale: q, isDirty: true });
  },
  setScale: (s) => {
    log.debug('setScale:', s);
    set({ scale: s, isDirty: true });
  },
  setPixelFormat: (f) => {
    log.debug('setPixelFormat:', f);
    set({ pixelFormat: f, isDirty: true });
  },
  setCopyMode: (c) => {
    log.debug('setCopyMode:', c);
    set({ copyMode: c, isDirty: true });
  },
  setTranscoder: (t) => {
    log.debug('setTranscoder:', t);
    set({ transcoder: t, isDirty: true });
  },
  setEncoderType: (type) => {
    log.debug('setEncoderType:', type);
    set({ encoderType: type, isDirty: true });
  },
  setIsConverting: (v) => {
    log.debug('setIsConverting:', v);
    if (!v) set({ isPaused: false });
    set({ isConverting: v });
  },
  setIsPaused: (v) => {
    log.debug('setIsPaused:', v);
    set({ isPaused: v });
  },
  setProgress: (p) => set({ progress: p }),
  resetForm: () => {
    log.info('resetForm');
    set(INITIAL_STATE);
  },
}));
