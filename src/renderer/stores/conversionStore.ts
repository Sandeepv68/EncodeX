import { create } from 'zustand';
import { CONVERSION_DEFAULTS, TRANSCODER_TYPES } from '../../shared/transcoder-constants';

interface ProgressData {
  percent: number;
  time: string;
  speed: string;
  eta: string;
}

interface ConversionState {
  inputFile: string | null;
  outputFile: string | null;
  videoCodec: string;
  audioCodec: string;
  videoBitrate: string;
  audioBitrate: string;
  qscale: number;
  scale: string;
  pixelFormat: string;
  copyMode: boolean;
  transcoder: string;
  isConverting: boolean;
  progress: ProgressData | null;
  setInputFile: (file: string | null) => void;
  setOutputFile: (file: string | null) => void;
  setVideoCodec: (codec: string) => void;
  setAudioCodec: (codec: string) => void;
  setVideoBitrate: (bitrate: string) => void;
  setAudioBitrate: (bitrate: string) => void;
  setQscale: (q: number) => void;
  setScale: (s: string) => void;
  setPixelFormat: (f: string) => void;
  setCopyMode: (c: boolean) => void;
  setTranscoder: (t: string) => void;
  setIsConverting: (v: boolean) => void;
  setProgress: (p: ProgressData | null) => void;
}

export const useConversionStore = create<ConversionState>((set) => ({
  inputFile: null,
  outputFile: null,
  videoCodec: CONVERSION_DEFAULTS.VIDEO_CODEC,
  audioCodec: CONVERSION_DEFAULTS.AUDIO_CODEC,
  videoBitrate: CONVERSION_DEFAULTS.VIDEO_BITRATE,
  audioBitrate: CONVERSION_DEFAULTS.AUDIO_BITRATE,
  qscale: CONVERSION_DEFAULTS.QSCALE,
  scale: CONVERSION_DEFAULTS.SCALE,
  pixelFormat: CONVERSION_DEFAULTS.PIXEL_FORMAT,
  copyMode: false,
  transcoder: TRANSCODER_TYPES[0],
  isConverting: false,
  progress: null,
  setInputFile: (file) => set({ inputFile: file }),
  setOutputFile: (file) => set({ outputFile: file }),
  setVideoCodec: (codec) => set({ videoCodec: codec }),
  setAudioCodec: (codec) => set({ audioCodec: codec }),
  setVideoBitrate: (bitrate) => set({ videoBitrate: bitrate }),
  setAudioBitrate: (bitrate) => set({ audioBitrate: bitrate }),
  setQscale: (q) => set({ qscale: q }),
  setScale: (s) => set({ scale: s }),
  setPixelFormat: (f) => set({ pixelFormat: f }),
  setCopyMode: (c) => set({ copyMode: c }),
  setTranscoder: (t) => set({ transcoder: t }),
  setIsConverting: (v) => set({ isConverting: v }),
  setProgress: (p) => set({ progress: p }),
}));
