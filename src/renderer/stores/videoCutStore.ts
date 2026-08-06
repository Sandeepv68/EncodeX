/**
 * @fileoverview Zustand store for the video cut form draft.
 * Persists the user's unsaved cut settings (source/output paths, cut window,
 * audio toggle) to localStorage under VIDEO_CUT_DRAFT_STORAGE_KEY
 * ('encodex-video-cut-draft') so the form survives navigating away and back.
 *
 * State held:
 *  - input / output / startTime / endTime / duration / useDuration /
 *    includeAudio: the user-editable cut fields, initialized from the persisted
 *    snapshot at module load
 *
 * Behavior notes:
 *  - Every setter persists the full draft snapshot to localStorage before
 *    updating state; storage failures are logged and swallowed.
 *  - resetForm() clears all fields and removes the persisted snapshot.
 *  - Run state (progress, pause flags) and media-derived state (playhead,
 *    waveform, thumbnails) are intentionally not part of this store - the page
 *    re-derives them on remount.
 *
 * Consumers:
 *  - The video cut page (pages/VideoCut.tsx), which binds its form fields to
 *    this store instead of local state.
 */

import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { VIDEO_CUT_DRAFT_STORAGE_KEY } from '../../shared/constants';
import type { VideoCutState } from './types';
import {
  LOG_FAILED_TO_PERSIST_VIDEO_CUT_DRAFT,
  LOG_FAILED_TO_READ_STORED_VIDEO_CUT_DRAFT,
  LOG_RESET_VIDEO_CUT_FORM,
  LOG_SET_DURATION,
  LOG_SET_END_TIME,
  LOG_SET_INCLUDE_AUDIO,
  LOG_SET_INPUT,
  LOG_SET_OUTPUT,
  LOG_SET_START_TIME,
  LOG_SET_USE_DURATION,
} from '../../shared/log-constants';

/**
 * Per-store logger for the video cut draft store.
 * @const {Logger} log
 */
const log = new Logger('renderer/stores/videoCutStore');

/**
 * Subset of the store that is persisted to localStorage: every user-editable
 * cut field. Media-derived data (waveform/thumbnails) and actions are excluded.
 * @typedef {Pick<VideoCutState, 'input' | 'output' | 'startTime' | 'endTime' | 'duration' | 'useDuration' | 'includeAudio'>} VideoCutDraft
 */

/**
 * Extracts the persisted subset (draft fields) from the full store state.
 * @param {VideoCutState} state - The full store state.
 * @returns {VideoCutDraft} The draft fields.
 */
function toDraft(
  state: VideoCutState,
): Pick<VideoCutState, 'input' | 'output' | 'startTime' | 'endTime' | 'duration' | 'useDuration' | 'includeAudio'> {
  return {
    input: state.input,
    output: state.output,
    startTime: state.startTime,
    endTime: state.endTime,
    duration: state.duration,
    useDuration: state.useDuration,
    includeAudio: state.includeAudio,
  };
}

/**
 * Initial (and reset) values for the video cut draft form.
 * @const {Object} INITIAL_STATE
 * @property {string} input - No source selected.
 * @property {string} output - No output selected.
 * @property {string} startTime - Default start at the beginning of the clip.
 * @property {string} endTime - No end time until the user enters one.
 * @property {string} duration - No duration until the user enters one.
 * @property {boolean} useDuration - Start/end mode by default.
 * @property {boolean} includeAudio - Audio is kept by default.
 */
const INITIAL_STATE = {
  input: '',
  output: '',
  startTime: '00:00:00',
  endTime: '',
  duration: '',
  useDuration: false,
  includeAudio: true,
};

/**
 * Initial (and reset) values for the in-memory waveform/thumbnail/zoom cache.
 * @const {Object} INITIAL_CACHE
 * @property {null} waveform - No cached waveform.
 * @property {null} waveformKey - No cached waveform key.
 * @property {null} thumbnails - No cached thumbnails.
 * @property {null} thumbnailsKey - No cached thumbnail key.
 * @property {null} zoom - No cached zoom level.
 * @property {null} zoomKey - No cached zoom key.
 */
const INITIAL_CACHE = {
  waveform: null,
  waveformKey: null,
  thumbnails: null,
  thumbnailsKey: null,
  zoom: null,
  zoomKey: null,
};

/**
 * Reads the persisted video cut draft from localStorage
 * ('encodex-video-cut-draft'). Missing or malformed values fall back to the
 * per-field defaults; storage/parse failures are logged and return the full
 * default snapshot.
 * @returns {Omit<VideoCutState, 'setInput' | 'setOutput' | 'setStartTime' | 'setEndTime' | 'setDuration' | 'setUseDuration' | 'setIncludeAudio' | 'resetForm'>} The validated draft snapshot.
 */
export function readStoredVideoCutDraft(): Pick<
  VideoCutState,
  'input' | 'output' | 'startTime' | 'endTime' | 'duration' | 'useDuration' | 'includeAudio'
> {
  try {
    const raw = localStorage.getItem(VIDEO_CUT_DRAFT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<VideoCutState>;
      return {
        input: typeof parsed.input === 'string' ? parsed.input : INITIAL_STATE.input,
        output: typeof parsed.output === 'string' ? parsed.output : INITIAL_STATE.output,
        startTime: typeof parsed.startTime === 'string' ? parsed.startTime : INITIAL_STATE.startTime,
        endTime: typeof parsed.endTime === 'string' ? parsed.endTime : INITIAL_STATE.endTime,
        duration: typeof parsed.duration === 'string' ? parsed.duration : INITIAL_STATE.duration,
        useDuration: typeof parsed.useDuration === 'boolean' ? parsed.useDuration : INITIAL_STATE.useDuration,
        includeAudio: typeof parsed.includeAudio === 'boolean' ? parsed.includeAudio : INITIAL_STATE.includeAudio,
      };
    }
  } catch (err) {
    log.warn(LOG_FAILED_TO_READ_STORED_VIDEO_CUT_DRAFT, err);
  }
  return { ...INITIAL_STATE };
}

/**
 * Serializes a video cut draft snapshot to localStorage
 * ('encodex-video-cut-draft'). Failures are logged and swallowed so a full
 * storage quota never breaks the cut form.
 * @param {Pick<VideoCutState, 'input' | 'output' | 'startTime' | 'endTime' | 'duration' | 'useDuration' | 'includeAudio'>} draft - The draft to persist.
 * @returns {void}
 */
function persistDraft(draft: {
  input: string;
  output: string;
  startTime: string;
  endTime: string;
  duration: string;
  useDuration: boolean;
  includeAudio: boolean;
}): void {
  try {
    localStorage.setItem(VIDEO_CUT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch (err) {
    log.warn(LOG_FAILED_TO_PERSIST_VIDEO_CUT_DRAFT, err);
  }
}

/**
 * The validated draft snapshot read from localStorage at module load, used to
 * initialize the store.
 * @const {Pick<VideoCutState, 'input' | 'output' | 'startTime' | 'endTime' | 'duration' | 'useDuration' | 'includeAudio'>} stored
 */
const stored = readStoredVideoCutDraft();

/**
 * Zustand store for the video cut form draft.
 * Implemented as a module-level singleton; React components consume it via the
 * useVideoCutStore hook and read/write state outside of React via
 * useVideoCutStore.getState() / setState().
 * @const {UseBoundStore<StoreApi<VideoCutState>>} useVideoCutStore
 */
export const useVideoCutStore = create<VideoCutState>((set) => ({
  ...stored,
  ...INITIAL_CACHE,
  /**
   * Sets the source video path and persists the draft.
   * @param {string} file - Absolute path of the source video, or '' to clear.
   */
  setInput: (file) => {
    log.debug(LOG_SET_INPUT, file);
    set((state) => {
      persistDraft({ ...toDraft(state), input: file });
      return { input: file };
    });
  },
  /**
   * Sets the output file path and persists the draft.
   * @param {string} file - Absolute path of the output file, or '' to clear.
   */
  setOutput: (file) => {
    log.debug(LOG_SET_OUTPUT, file);
    set((state) => {
      persistDraft({ ...toDraft(state), output: file });
      return { output: file };
    });
  },
  /**
   * Sets the cut start time and persists the draft.
   * @param {string} time - Start time as an `HH:MM:SS[.mmm]` string.
   */
  setStartTime: (time) => {
    log.debug(LOG_SET_START_TIME, time);
    set((state) => {
      persistDraft({ ...toDraft(state), startTime: time });
      return { startTime: time };
    });
  },
  /**
   * Sets the cut end time and persists the draft.
   * @param {string} time - End time, or '' to clear.
   */
  setEndTime: (time) => {
    log.debug(LOG_SET_END_TIME, time);
    set((state) => {
      persistDraft({ ...toDraft(state), endTime: time });
      return { endTime: time };
    });
  },
  /**
   * Sets the cut duration and persists the draft.
   * @param {string} duration - Duration, or '' to clear.
   */
  setDuration: (duration) => {
    log.debug(LOG_SET_DURATION, duration);
    set((state) => {
      persistDraft({ ...toDraft(state), duration });
      return { duration };
    });
  },
  /**
   * Sets the use-duration flag and persists the draft.
   * @param {boolean} use - True to use start + duration instead of start/end.
   */
  setUseDuration: (use) => {
    log.debug(LOG_SET_USE_DURATION, use);
    set((state) => {
      persistDraft({ ...toDraft(state), useDuration: use });
      return { useDuration: use };
    });
  },
  /**
   * Sets the include-audio toggle and persists the draft.
   * @param {boolean} include - True to keep the audio stream in the output.
   */
  setIncludeAudio: (include) => {
    log.debug(LOG_SET_INCLUDE_AUDIO, include);
    set((state) => {
      persistDraft({ ...toDraft(state), includeAudio: include });
      return { includeAudio: include };
    });
  },
  /**
   * Caches the extracted timeline waveform together with the cache key
   * (`input::duration`) it belongs to. Passing null (optionally with a null key)
   * clears the cached waveform. The cache is kept in memory only and never
   * written to localStorage.
   * @param {WaveformData | null} data - The waveform data, or null to clear.
   * @param {string | null} [key] - The cache key the data belongs to.
   * @returns {void}
   */
  cacheWaveform: (data, key = null) => {
    set({ waveform: data, waveformKey: key });
  },
  /**
   * Caches the extracted timeline thumbnail strip together with the cache key
   * (`input::duration`) it belongs to. Passing null (optionally with a null key)
   * clears the cached thumbnails. The cache is kept in memory only and never
   * written to localStorage.
   * @param {ThumbnailStrip | null} data - The thumbnail strip, or null to clear.
   * @param {string | null} [key] - The cache key the data belongs to.
   * @returns {void}
   */
  cacheThumbnails: (data, key = null) => {
    set({ thumbnails: data, thumbnailsKey: key });
  },
  /**
   * Caches the timeline zoom level (pixels per second) together with the cache
   * key (`input::duration`) it belongs to. Passing null (optionally with a null
   * key) clears the cached zoom. The cache is kept in memory only and never
   * written to localStorage.
   * @param {number | null} zoom - The zoom level, or null to clear.
   * @param {string | null} [key] - The cache key the zoom belongs to.
   * @returns {void}
   */
  cacheZoom: (zoom, key = null) => {
    set({ zoom, zoomKey: key });
  },
  /**
   * Clears every draft field and removes the persisted snapshot.
   * @returns {void}
   */
  resetForm: () => {
    log.debug(LOG_RESET_VIDEO_CUT_FORM);
    try {
      localStorage.removeItem(VIDEO_CUT_DRAFT_STORAGE_KEY);
    } catch (err) {
      log.warn(LOG_FAILED_TO_PERSIST_VIDEO_CUT_DRAFT, err);
    }
    set({ ...INITIAL_STATE, ...INITIAL_CACHE });
  },
}));
