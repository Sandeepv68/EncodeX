import { describe, it, expect, beforeEach } from 'vitest';
import { useVideoCutStore, readStoredVideoCutDraft, isVideoCutDirty } from '../videoCutStore';
import { VIDEO_CUT_DRAFT_STORAGE_KEY } from '../../../shared/constants';

const DEFAULT_DRAFT = {
  input: '',
  output: '',
  startTime: '00:00:00',
  endTime: '',
  duration: '',
  useDuration: false,
  includeAudio: true,
};

const DEFAULT_STATE = {
  ...DEFAULT_DRAFT,
  isCutting: false,
  waveform: null,
  waveformKey: null,
  thumbnails: null,
  thumbnailsKey: null,
  zoom: null,
  zoomKey: null,
};

describe('videoCutStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useVideoCutStore.setState(DEFAULT_STATE);
  });

  it('initializes with default form values', () => {
    expect(useVideoCutStore.getState()).toMatchObject(DEFAULT_STATE);
  });

  it('setInput updates the value and persists the draft', () => {
    useVideoCutStore.getState().setInput('/in/video.mp4');
    expect(useVideoCutStore.getState().input).toBe('/in/video.mp4');
    const stored = JSON.parse(localStorage.getItem(VIDEO_CUT_DRAFT_STORAGE_KEY) as string);
    expect(stored.input).toBe('/in/video.mp4');
  });

  it('setOutput updates the value and persists the draft', () => {
    useVideoCutStore.getState().setOutput('/out/cut.mp4');
    expect(useVideoCutStore.getState().output).toBe('/out/cut.mp4');
    const stored = JSON.parse(localStorage.getItem(VIDEO_CUT_DRAFT_STORAGE_KEY) as string);
    expect(stored.output).toBe('/out/cut.mp4');
  });

  it('setStartTime and setEndTime persist the cut window', () => {
    useVideoCutStore.getState().setStartTime('00:00:05');
    useVideoCutStore.getState().setEndTime('00:01:30');
    const stored = JSON.parse(localStorage.getItem(VIDEO_CUT_DRAFT_STORAGE_KEY) as string);
    expect(stored.startTime).toBe('00:00:05');
    expect(stored.endTime).toBe('00:01:30');
  });

  it('setDuration and setUseDuration persist the duration mode', () => {
    useVideoCutStore.getState().setUseDuration(true);
    useVideoCutStore.getState().setDuration('00:00:45');
    const stored = JSON.parse(localStorage.getItem(VIDEO_CUT_DRAFT_STORAGE_KEY) as string);
    expect(stored.useDuration).toBe(true);
    expect(stored.duration).toBe('00:00:45');
  });

  it('setIncludeAudio persists the audio toggle', () => {
    useVideoCutStore.getState().setIncludeAudio(false);
    expect(useVideoCutStore.getState().includeAudio).toBe(false);
    const stored = JSON.parse(localStorage.getItem(VIDEO_CUT_DRAFT_STORAGE_KEY) as string);
    expect(stored.includeAudio).toBe(false);
  });

  it('persists the remaining draft fields when a single setter runs', () => {
    useVideoCutStore.getState().setInput('/in/video.mp4');
    useVideoCutStore.getState().setOutput('/out/cut.mp4');
    useVideoCutStore.getState().setEndTime('00:00:10');
    useVideoCutStore.getState().setIncludeAudio(false);
    const stored = JSON.parse(localStorage.getItem(VIDEO_CUT_DRAFT_STORAGE_KEY) as string);
    expect(stored).toEqual({ ...DEFAULT_DRAFT, input: '/in/video.mp4', output: '/out/cut.mp4', endTime: '00:00:10', includeAudio: false });
  });

  it('resetForm clears every field and removes the persisted snapshot', () => {
    useVideoCutStore.getState().setInput('/in/video.mp4');
    useVideoCutStore.getState().setOutput('/out/cut.mp4');
    useVideoCutStore.getState().setUseDuration(true);
    useVideoCutStore.getState().cacheWaveform({ sampleRate: 8000, samplesPerBucket: 1000, buckets: [] }, '/in/video.mp4::60');
    useVideoCutStore.getState().resetForm();
    expect(useVideoCutStore.getState()).toMatchObject(DEFAULT_STATE);
    expect(localStorage.getItem(VIDEO_CUT_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it('cacheWaveform stores the data and its key in memory', () => {
    const data = { sampleRate: 8000, samplesPerBucket: 1000, buckets: [{ min: -1, max: 1 }] };
    useVideoCutStore.getState().cacheWaveform(data, '/in/video.mp4::60');
    expect(useVideoCutStore.getState().waveform).toBe(data);
    expect(useVideoCutStore.getState().waveformKey).toBe('/in/video.mp4::60');
  });

  it('cacheThumbnails stores the data and its key in memory', () => {
    const data = { dataUrl: 'data:image/png;base64,AAAA', cols: 2, rows: 2, thumbWidth: 160, thumbHeight: 90, interval: 7.5, count: 3 };
    useVideoCutStore.getState().cacheThumbnails(data, '/in/video.mp4::60');
    expect(useVideoCutStore.getState().thumbnails).toBe(data);
    expect(useVideoCutStore.getState().thumbnailsKey).toBe('/in/video.mp4::60');
  });

  it('cacheZoom stores the zoom and its key in memory', () => {
    useVideoCutStore.getState().cacheZoom(42, '/in/video.mp4::60');
    expect(useVideoCutStore.getState().zoom).toBe(42);
    expect(useVideoCutStore.getState().zoomKey).toBe('/in/video.mp4::60');
  });

  it('clears the media cache when passed null without a key', () => {
    useVideoCutStore.getState().cacheWaveform({ sampleRate: 8000, samplesPerBucket: 1000, buckets: [] }, '/in/video.mp4::60');
    useVideoCutStore
      .getState()
      .cacheThumbnails(
        { dataUrl: 'data:image/png;base64,AAAA', cols: 2, rows: 2, thumbWidth: 160, thumbHeight: 90, interval: 7.5, count: 3 },
        '/in/video.mp4::60',
      );
    useVideoCutStore.getState().cacheZoom(42, '/in/video.mp4::60');
    useVideoCutStore.getState().cacheWaveform(null);
    useVideoCutStore.getState().cacheThumbnails(null);
    useVideoCutStore.getState().cacheZoom(null);
    expect(useVideoCutStore.getState().waveform).toBeNull();
    expect(useVideoCutStore.getState().waveformKey).toBeNull();
    expect(useVideoCutStore.getState().thumbnails).toBeNull();
    expect(useVideoCutStore.getState().thumbnailsKey).toBeNull();
    expect(useVideoCutStore.getState().zoom).toBeNull();
    expect(useVideoCutStore.getState().zoomKey).toBeNull();
  });

  it('never persists the media cache to localStorage', () => {
    useVideoCutStore.getState().setInput('/in/video.mp4');
    useVideoCutStore.getState().cacheWaveform({ sampleRate: 8000, samplesPerBucket: 1000, buckets: [] }, '/in/video.mp4::60');
    useVideoCutStore
      .getState()
      .cacheThumbnails(
        { dataUrl: 'data:image/png;base64,AAAA', cols: 2, rows: 2, thumbWidth: 160, thumbHeight: 90, interval: 7.5, count: 3 },
        '/in/video.mp4::60',
      );
    useVideoCutStore.getState().cacheZoom(42, '/in/video.mp4::60');
    useVideoCutStore.getState().setEndTime('00:00:10');
    const stored = JSON.parse(localStorage.getItem(VIDEO_CUT_DRAFT_STORAGE_KEY) as string);
    expect(stored).toEqual({ ...DEFAULT_DRAFT, input: '/in/video.mp4', endTime: '00:00:10' });
    expect(stored.waveform).toBeUndefined();
    expect(stored.thumbnails).toBeUndefined();
    expect(stored.zoom).toBeUndefined();
  });

  it('toggles the isCutting run flag', () => {
    expect(useVideoCutStore.getState().isCutting).toBe(false);
    useVideoCutStore.getState().setIsCutting(true);
    expect(useVideoCutStore.getState().isCutting).toBe(true);
    useVideoCutStore.getState().setIsCutting(false);
    expect(useVideoCutStore.getState().isCutting).toBe(false);
  });
});

describe('isVideoCutDirty', () => {
  it('returns false for the blank form', () => {
    expect(isVideoCutDirty(DEFAULT_DRAFT)).toBe(false);
  });

  it.each([
    ['input', { input: '/in/video.mp4' }],
    ['output', { output: '/out/cut.mp4' }],
    ['startTime', { startTime: '00:00:05' }],
    ['endTime', { endTime: '00:01:30' }],
    ['duration', { duration: '00:00:45' }],
    ['useDuration', { useDuration: true }],
    ['includeAudio off', { includeAudio: false }],
  ])('returns true when %s is set', (_label, override) => {
    expect(isVideoCutDirty({ ...DEFAULT_DRAFT, ...override })).toBe(true);
  });
});

describe('readStoredVideoCutDraft', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when nothing is stored', () => {
    expect(readStoredVideoCutDraft()).toEqual(DEFAULT_DRAFT);
  });

  it('reads the persisted draft', () => {
    localStorage.setItem(
      VIDEO_CUT_DRAFT_STORAGE_KEY,
      JSON.stringify({ input: '/in/video.mp4', output: '/out/cut.mp4', startTime: '00:00:02', useDuration: true, duration: '00:01:00' }),
    );
    expect(readStoredVideoCutDraft()).toEqual({
      ...DEFAULT_DRAFT,
      input: '/in/video.mp4',
      output: '/out/cut.mp4',
      startTime: '00:00:02',
      useDuration: true,
      duration: '00:01:00',
    });
  });

  it('falls back to defaults for an unknown stored field type', () => {
    localStorage.setItem(
      VIDEO_CUT_DRAFT_STORAGE_KEY,
      JSON.stringify({ input: 42, useDuration: 'yes', includeAudio: 'nope', output: '/out/cut.mp4' }),
    );
    expect(readStoredVideoCutDraft()).toEqual({ ...DEFAULT_DRAFT, output: '/out/cut.mp4' });
  });

  it('falls back to defaults for corrupted storage', () => {
    localStorage.setItem(VIDEO_CUT_DRAFT_STORAGE_KEY, '{ not json');
    expect(readStoredVideoCutDraft()).toEqual(DEFAULT_DRAFT);
  });
});
