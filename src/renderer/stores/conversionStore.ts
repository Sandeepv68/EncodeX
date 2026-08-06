/**
 * @fileoverview Zustand store for conversion job state management.
 * Holds every user-editable field of the main conversion form (input/output
 * files, video/audio codecs and bitrates, qscale, scale, pixel format, copy
 * mode, transcoder, encoder type) plus the live run state (isConverting,
 * isPaused, isDirty, progress) of the current conversion.
 *
 * State held:
 *  - Form fields backed by CONVERSION_DEFAULTS, TRANSCODER_TYPES[0] and
 *    ENCODER_TYPE_DEFAULT
 *  - outputUserSet flag distinguishing user-chosen vs auto-suggested outputs
 *  - isDirty dirty-tracking flag used to warn about unsaved changes
 *  - progress (ProgressData) surfaced to the conversion UI
 *
 * Consumers:
 *  - The main conversion form/panel components in the renderer, which read the
 *    form fields and call the setter actions
 *  - Progress display components that read `progress`
 *
 * Behavior notes:
 *  - Every form setter marks the form dirty (isDirty = true).
 *  - setIsConverting(false) also resets isPaused to false.
 *  - resetForm() restores the whole store to INITIAL_STATE, so it doubles as
 *    the initial-state factory for the create() call.
 *  - This store only holds state; the actual conversion is started elsewhere
 *    via window.electronAPI.convertFile, and progress events are forwarded into
 *    setProgress by the caller/subscription.
 */

import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { CONVERSION_DEFAULTS, TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import { ENCODER_TYPE_DEFAULT } from '../../shared/hwaccel-settings';
import type { EncoderType } from '../../shared/types';
import type { ConversionState, ProgressData } from './types';
import {
  LOG_RESET_FORM,
  LOG_SET_AUDIO_BITRATE,
  LOG_SET_AUDIO_CODEC,
  LOG_SET_COPY_MODE,
  LOG_SET_ENCODER_TYPE,
  LOG_SET_INPUT_FILE,
  LOG_SET_IS_CONVERTING,
  LOG_SET_IS_PAUSED,
  LOG_SET_OUTPUT_AUTO,
  LOG_SET_OUTPUT_FILE,
  LOG_SET_PIXEL_FORMAT,
  LOG_SET_QSCALE,
  LOG_SET_SCALE,
  LOG_SET_TRANSCODER,
  LOG_SET_VIDEO_BITRATE,
  LOG_SET_VIDEO_CODEC,
} from '../../shared/log-constants';

/**
 * Per-store logger for the conversion store.
 * @const {Logger} log
 */
const log = new Logger('renderer/stores/conversionStore');

/**
 * Initial (and reset) values for the conversion form and run state.
 * All encoding defaults come from CONVERSION_DEFAULTS; the transcoder starts
 * at TRANSCODER_TYPES[0] ('FFMPEG') and the encoder type at
 * ENCODER_TYPE_DEFAULT ('auto').
 * @const {Object} INITIAL_STATE
 * @property {string | null} inputFile - No input selected.
 * @property {string | null} outputFile - No output selected.
 * @property {boolean} outputUserSet - Output not user-chosen.
 * @property {string} videoCodec - CONVERSION_DEFAULTS.VIDEO_CODEC ('libx264').
 * @property {string} audioCodec - CONVERSION_DEFAULTS.AUDIO_CODEC ('aac').
 * @property {string} videoBitrate - CONVERSION_DEFAULTS.VIDEO_BITRATE ('2000k').
 * @property {string} audioBitrate - CONVERSION_DEFAULTS.AUDIO_BITRATE ('192k').
 * @property {number} qscale - CONVERSION_DEFAULTS.QSCALE (23).
 * @property {string} scale - CONVERSION_DEFAULTS.SCALE ('1920x1080').
 * @property {string} pixelFormat - CONVERSION_DEFAULTS.PIXEL_FORMAT ('yuv420p').
 * @property {boolean} copyMode - Copy mode off.
 * @property {string} transcoder - TRANSCODER_TYPES[0] ('FFMPEG').
 * @property {EncoderType} encoderType - ENCODER_TYPE_DEFAULT ('auto').
 * @property {boolean} isConverting - Not converting.
 * @property {boolean} isPaused - Not paused.
 * @property {boolean} isDirty - Form not dirty.
 * @property {null} progress - No progress.
 */
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

/**
 * Zustand store for conversion job state management.
 * Implemented as a module-level singleton; React components consume it via the
 * useConversionStore hook and read/write state outside of React via
 * useConversionStore.getState() / setState().
 * @const {UseBoundStore<StoreApi<ConversionState>>} useConversionStore
 */
export const useConversionStore = create<ConversionState>((set) => ({
  ...INITIAL_STATE,
  /**
   * Sets the input file and marks the form dirty.
   * @param {string | null} file - Absolute path of the input file, or null to clear.
   */
  setInputFile: (file) => {
    log.debug(LOG_SET_INPUT_FILE, file);
    set({ inputFile: file, isDirty: true });
  },
  /**
   * Sets a user-chosen output file, marks outputUserSet, and marks the form dirty.
   * @param {string | null} file - Absolute path of the output file, or null to clear.
   */
  setOutputFile: (file) => {
    log.debug(LOG_SET_OUTPUT_FILE, file);
    set({ outputFile: file, outputUserSet: true, isDirty: true });
  },
  /**
   * Sets an auto-suggested output file and marks the form dirty.
   * Unlike setOutputFile, does not set outputUserSet, so the UI can still treat
   * the output as derived from the input.
   * @param {string | null} file - Auto-suggested output path, or null to clear.
   */
  setOutputAuto: (file) => {
    log.debug(LOG_SET_OUTPUT_AUTO, file);
    set({ outputFile: file, isDirty: true });
  },
  /**
   * Sets the video encoder and marks the form dirty.
   * @param {string} codec - Video encoder name (e.g. 'libx264').
   */
  setVideoCodec: (codec) => {
    log.debug(LOG_SET_VIDEO_CODEC, codec);
    set({ videoCodec: codec, isDirty: true });
  },
  /**
   * Sets the audio encoder and marks the form dirty.
   * @param {string} codec - Audio encoder name (e.g. 'aac').
   */
  setAudioCodec: (codec) => {
    log.debug(LOG_SET_AUDIO_CODEC, codec);
    set({ audioCodec: codec, isDirty: true });
  },
  /**
   * Sets the target video bitrate and marks the form dirty.
   * @param {string} bitrate - Video bitrate string (e.g. '2000k').
   */
  setVideoBitrate: (bitrate) => {
    log.debug(LOG_SET_VIDEO_BITRATE, bitrate);
    set({ videoBitrate: bitrate, isDirty: true });
  },
  /**
   * Sets the target audio bitrate and marks the form dirty.
   * @param {string} bitrate - Audio bitrate string (e.g. '192k').
   */
  setAudioBitrate: (bitrate) => {
    log.debug(LOG_SET_AUDIO_BITRATE, bitrate);
    set({ audioBitrate: bitrate, isDirty: true });
  },
  /**
   * Sets the video quality scale and marks the form dirty.
   * @param {number} q - Qscale value, 1 (best) to 31 (worst).
   */
  setQscale: (q) => {
    log.debug(LOG_SET_QSCALE, q);
    set({ qscale: q, isDirty: true });
  },
  /**
   * Sets the output resolution and marks the form dirty.
   * @param {string} s - Scale string WIDTHxHEIGHT (e.g. '1920x1080').
   */
  setScale: (s) => {
    log.debug(LOG_SET_SCALE, s);
    set({ scale: s, isDirty: true });
  },
  /**
   * Sets the output pixel format and marks the form dirty.
   * @param {string} f - Pixel format (e.g. 'yuv420p').
   */
  setPixelFormat: (f) => {
    log.debug(LOG_SET_PIXEL_FORMAT, f);
    set({ pixelFormat: f, isDirty: true });
  },
  /**
   * Sets copy mode (stream-copy without re-encoding) and marks the form dirty.
   * @param {boolean} c - True to enable copy mode.
   */
  setCopyMode: (c) => {
    log.debug(LOG_SET_COPY_MODE, c);
    set({ copyMode: c, isDirty: true });
  },
  /**
   * Sets the transcoder backend and marks the form dirty.
   * @param {string} t - Transcoder identifier ('FFMPEG' | 'FFTOOL' | 'BMF').
   */
  setTranscoder: (t) => {
    log.debug(LOG_SET_TRANSCODER, t);
    set({ transcoder: t, isDirty: true });
  },
  /**
   * Sets the encoder preference (hardware/software/auto) and marks the form dirty.
   * @param {EncoderType} type - Encoder type ('auto' | 'hardware' | 'software').
   */
  setEncoderType: (type) => {
    log.debug(LOG_SET_ENCODER_TYPE, type);
    set({ encoderType: type, isDirty: true });
  },
  /**
   * Sets the converting flag. Setting it to false also resets isPaused to false
   * (a paused run cannot be "converting").
   * @param {boolean} v - True while a conversion is running.
   */
  setIsConverting: (v) => {
    log.debug(LOG_SET_IS_CONVERTING, v);
    if (!v) set({ isPaused: false });
    set({ isConverting: v });
  },
  /**
   * Sets the paused flag.
   * @param {boolean} v - True while the conversion is paused.
   */
  setIsPaused: (v) => {
    log.debug(LOG_SET_IS_PAUSED, v);
    set({ isPaused: v });
  },
  /**
   * Sets the live conversion progress (or null to clear it).
   * @param {ProgressData | null} p - Progress data, or null when idle/complete.
   */
  setProgress: (p) => set({ progress: p }),
  /**
   * Restores the entire store to its initial values (INITIAL_STATE), clearing
   * all form fields, run flags, dirty flag, and progress. Because INITIAL_STATE
   * is spread into the store at creation, the state object identity is the same
   * shape used at startup.
   */
  resetForm: () => {
    log.info(LOG_RESET_FORM);
    set(INITIAL_STATE);
  },
}));
