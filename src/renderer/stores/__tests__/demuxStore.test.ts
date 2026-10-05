import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDemuxStore } from '../demuxStore';
import { useErrorStore } from '../errorStore';
import { useToastStore } from '../toastStore';
import { ErrorCode } from '../../../shared/errors';
import type { MediaInfo } from '../../../shared/types';

vi.mock('../../../shared/analytics/AnalyticsService', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../shared/analytics/AnalyticsService')>();
  return { ...mod, recordAnalyticsEvent: vi.fn() };
});
import { recordAnalyticsEvent } from '../../../shared/analytics/AnalyticsService';
import { expectAppLog } from '../../../test-utils/crash-tripwire';

const recordAnalyticsMock = vi.mocked(recordAnalyticsEvent);

const getMediaInfoMock = vi.mocked(window.electronAPI.getMediaInfo);
const convertFileMock = vi.mocked(window.electronAPI.convertFile);
const pauseConversionMock = vi.mocked(window.electronAPI.pauseConversion);
const resumeConversionMock = vi.mocked(window.electronAPI.resumeConversion);
const cancelConversionMock = vi.mocked(window.electronAPI.cancelConversion);
const progressHandler = vi.mocked(window.electronAPI.onConversionProgress).mock.calls[0]?.[0];

function resetStore(): void {
  useDemuxStore.setState({
    input: '',
    streams: [],
    selectedIndices: [],
    outputDir: '',
    targets: [],
    warnings: [],
    media: {},
    isConverting: false,
    isPaused: false,
    progress: null,
    current: null,
  });
  useErrorStore.setState({ currentError: null, errorHistory: [] });
  useToastStore.setState({ toasts: [] });
}

function emitProgress(percent: number, output?: string): void {
  progressHandler?.({
    input: 'in.mkv',
    output: output ?? 'out.mp4',
    progress: { percent, time: '00:00:01', fps: 24, speed: '1x', eta: '5', bitrate: '100k' },
  });
}

const SAMPLE_STREAMS: MediaInfo['streams'] = [
  { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 },
  { index: 1, type: 'audio', codec: 'aac', channels: 2 },
  { index: 2, type: 'audio', codec: 'ac3', channels: 6 },
  { index: 3, type: 'subtitle', codec: 'subrip' },
];

const SAMPLE_INFO: MediaInfo = {
  file: '/in/movie.mkv',
  format: 'matroska',
  size: 1024,
  duration: 60,
  bitrate: '1000k',
  streams: SAMPLE_STREAMS,
};

describe('demuxStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    getMediaInfoMock.mockResolvedValue(SAMPLE_INFO);
    convertFileMock.mockResolvedValue(undefined);
    pauseConversionMock.mockResolvedValue(undefined);
    resumeConversionMock.mockResolvedValue(undefined);
    cancelConversionMock.mockResolvedValue(undefined);
  });

  it('has default state', () => {
    const state = useDemuxStore.getState();
    expect(state.input).toBe('');
    expect(state.streams).toEqual([]);
    expect(state.selectedIndices).toEqual([]);
    expect(state.outputDir).toBe('');
    expect(state.targets).toEqual([]);
    expect(state.warnings).toEqual([]);
    expect(state.media).toEqual({});
    expect(state.isConverting).toBe(false);
    expect(state.isPaused).toBe(false);
    expect(state.progress).toBeNull();
    expect(state.current).toBeNull();
  });

  it('setInput probes and generates targets for every non-cover stream', async () => {
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    const state = useDemuxStore.getState();
    expect(getMediaInfoMock).toHaveBeenCalledWith('/in/movie.mkv', 'FFMPEG');
    expect(state.input).toBe('/in/movie.mkv');
    expect(state.streams).toEqual(SAMPLE_STREAMS);
    expect(state.selectedIndices).toEqual([0, 1, 2, 3]);
    expect(state.outputDir).toBe('/in');
    expect(state.targets).toHaveLength(4);
    expect(state.targets.map((t) => t.map)).toEqual(['0:v:0', '0:a:0', '0:a:1', '0:s:0']);
  });

  it('setInput skips cover-art streams', async () => {
    getMediaInfoMock.mockResolvedValue({
      ...SAMPLE_INFO,
      streams: [
        { index: 0, type: 'video', codec: 'h264' },
        { index: 1, type: 'video', codec: 'mjpeg', disposition: ['attached_pic'] },
      ],
    });
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    const state = useDemuxStore.getState();
    expect(state.streams).toHaveLength(1);
    expect(state.selectedIndices).toEqual([0]);
  });

  it('setInput surfaces a probe failure via the error store', async () => {
    getMediaInfoMock.mockRejectedValue(new Error('probe boom'));
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    expect(useErrorStore.getState().currentError?.detail).toBe('probe boom');
    expect(useDemuxStore.getState().input).toBe('');
  });

  it('toggleStream adds and removes indices and regenerates targets', async () => {
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    useDemuxStore.getState().toggleStream(1);
    let state = useDemuxStore.getState();
    expect(state.selectedIndices).toEqual([0, 2, 3]);
    expect(state.targets.map((t) => t.index)).toEqual([0, 2, 3]);
    expect(state.targets.map((t) => t.map)).toEqual(['0:v:0', '0:a:1', '0:s:0']);
    useDemuxStore.getState().toggleStream(1);
    state = useDemuxStore.getState();
    expect(state.selectedIndices).toEqual([0, 1, 2, 3]);
  });

  it('setMedia converts audio when an audioCodec is set', async () => {
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    useDemuxStore.getState().setMedia({ audioCodec: 'mp3' });
    const audio = useDemuxStore.getState().targets.filter((t) => t.kind === 'audio');
    expect(audio[0]).toEqual(expect.objectContaining({ copy: false, codec: 'mp3', output: '/in/movie.audio_0.mp3' }));
    expect(audio[1]).toEqual(expect.objectContaining({ copy: false, codec: 'mp3' }));
    const video = useDemuxStore.getState().targets.find((t) => t.kind === 'video');
    expect(video).toEqual(expect.objectContaining({ copy: true }));
  });

  it('setMedia clears conversion back to copy when prefs are removed', async () => {
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    useDemuxStore.getState().setMedia({ audioCodec: 'mp3' });
    useDemuxStore.getState().setMedia({});
    const audio = useDemuxStore.getState().targets.filter((t) => t.kind === 'audio');
    expect(audio[0]).toEqual(expect.objectContaining({ copy: true }));
  });

  it('warns and keeps bitmap subtitles as mks copy when a text conversion is requested', async () => {
    getMediaInfoMock.mockResolvedValue({
      ...SAMPLE_INFO,
      streams: [
        { index: 0, type: 'video', codec: 'h264' },
        { index: 1, type: 'subtitle', codec: 'subrip' },
        { index: 2, type: 'subtitle', codec: 'hdmv_pgs_subtitle' },
      ],
    });
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    useDemuxStore.getState().setMedia({ subtitleCodec: 'srt' });
    const state = useDemuxStore.getState();
    const bitmap = state.targets.find((t) => t.index === 2);
    expect(bitmap).toEqual(expect.objectContaining({ copy: true, output: '/in/movie.subtitle_1.mks' }));
    expect(state.warnings).toHaveLength(1);
    expect(state.warnings[0]).toMatchObject({ code: 'bitmapSubtitleWarning', icon: 'warning' });

    useDemuxStore.getState().setMedia({});
    expect(useDemuxStore.getState().warnings).toEqual([]);
  });

  it('produces no warnings for text subtitle conversions or copy mode', async () => {
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    useDemuxStore.getState().setMedia({ subtitleCodec: 'ass' });
    expect(useDemuxStore.getState().warnings).toEqual([]);
    const textTarget = useDemuxStore.getState().targets.find((t) => t.kind === 'subtitle');
    expect(textTarget).toEqual(expect.objectContaining({ copy: false, codec: 'ass' }));
  });

  it('setMedia carries videoFilters onto a re-encoding video target', async () => {
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    useDemuxStore.getState().setMedia({ videoContainer: 'webm', videoFilters: ['fps=30', 'hue=s=0'] });
    const state = useDemuxStore.getState();
    const video = state.targets.find((t) => t.kind === 'video');
    expect(video).toEqual(expect.objectContaining({ copy: false, videoFilters: ['fps=30', 'hue=s=0'] }));
    expect(state.warnings.some((w) => w.code === 'filtersIgnoredCopy')).toBe(false);
  });

  it('warns that videoFilters are ignored while the video target is Copy', async () => {
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    useDemuxStore.getState().setMedia({ videoFilters: ['fps=30'] });
    const state = useDemuxStore.getState();
    expect(state.targets.find((t) => t.kind === 'video')?.videoFilters ?? []).toEqual([]);
    expect(state.warnings).toHaveLength(1);
    expect(state.warnings[0]).toMatchObject({ code: 'filtersIgnoredCopy', icon: 'warning' });

    useDemuxStore.getState().setMedia({ videoFilters: [] });
    expect(useDemuxStore.getState().warnings).toEqual([]);
  });

  it('never attaches videoFilters to audio or subtitle targets', async () => {
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    useDemuxStore.getState().setMedia({ videoContainer: 'webm', videoFilters: ['fps=30'] });
    const state = useDemuxStore.getState();
    expect(state.targets.find((t) => t.kind === 'audio')?.videoFilters ?? []).toEqual([]);
    expect(state.targets.find((t) => t.kind === 'subtitle')?.videoFilters ?? []).toEqual([]);
  });

  it('setOutputDir regenerates the absolute output paths', async () => {
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    useDemuxStore.getState().setOutputDir('/out/dir');
    const state = useDemuxStore.getState();
    expect(state.outputDir).toBe('/out/dir');
    expect(state.targets[0].output).toBe('/out/dir/movie.video.mp4');
  });

  it('startDemux shows INPUT_NOT_SPECIFIED without an input', async () => {
    expectAppLog('warn', 'renderer/stores/demuxStore');

    useDemuxStore.setState({ input: '', targets: [{ index: 0, kind: 'video', map: '0:v:0', copy: true, output: '/out/movie.video.mp4' }] });
    await useDemuxStore.getState().startDemux();
    expect(convertFileMock).not.toHaveBeenCalled();
    expect(useErrorStore.getState().currentError?.code).toBe(ErrorCode.INPUT_NOT_SPECIFIED);
  });

  it('startDemux shows STREAM_NOT_FOUND with no targets', async () => {
    useDemuxStore.setState({ input: '/in/movie.mkv', targets: [] });
    await useDemuxStore.getState().startDemux();
    expect(convertFileMock).not.toHaveBeenCalled();
    expect(useErrorStore.getState().currentError?.code).toBe(ErrorCode.STREAM_NOT_FOUND);
  });

  it('startDemux runs each target sequentially', async () => {
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    await useDemuxStore.getState().startDemux();
    expect(convertFileMock).toHaveBeenCalledTimes(4);
    expect(convertFileMock).toHaveBeenNthCalledWith(
      1,
      '/in/movie.mkv',
      '/in/movie.video.mp4',
      expect.objectContaining({ copy: true, map: ['0:v:0'], video: true, audio: false }),
      'FFMPEG',
    );
    expect(useDemuxStore.getState().isConverting).toBe(false);
    expect(useDemuxStore.getState().progress).toBeNull();
    expect(useDemuxStore.getState().current).toBeNull();
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('startDemux converts when a target is not stream-copied', async () => {
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    useDemuxStore.setState({ selectedIndices: [1], media: { audioCodec: 'mp3' } });
    useDemuxStore.getState().setMedia({ audioCodec: 'mp3' });
    useDemuxStore.setState({
      targets: [{ index: 1, kind: 'audio', map: '0:a:0', copy: false, codec: 'mp3', output: '/in/movie.audio_0.mp3' }],
    });
    await useDemuxStore.getState().startDemux();
    expect(convertFileMock).toHaveBeenCalledWith(
      '/in/movie.mkv',
      '/in/movie.audio_0.mp3',
      expect.objectContaining({ copy: false, map: ['0:a:0'], audioCodec: 'mp3', video: false, audio: true }),
      'FFMPEG',
    );
  });

  it('startDemux passes videoFilters through on a re-encoding video target', async () => {
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    useDemuxStore.setState({ selectedIndices: [0], media: { videoContainer: 'webm', videoFilters: ['fps=30'] } });
    useDemuxStore.getState().setMedia({ videoContainer: 'webm', videoFilters: ['fps=30'] });
    useDemuxStore.setState({
      targets: [
        {
          index: 0,
          kind: 'video',
          map: '0:v:0',
          copy: false,
          codec: 'libvpx-vp9',
          container: 'webm',
          output: '/in/movie.video.webm',
          videoFilters: ['fps=30'],
        },
      ],
    });
    await useDemuxStore.getState().startDemux();
    expect(convertFileMock).toHaveBeenCalledWith(
      '/in/movie.mkv',
      '/in/movie.video.webm',
      expect.objectContaining({ copy: false, map: ['0:v:0'], videoFilters: ['fps=30'] }),
      'FFMPEG',
    );
  });

  it('startDemux stops after the first failing target and reports the error', async () => {
    convertFileMock.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('boom'));
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    await useDemuxStore.getState().startDemux();
    expect(convertFileMock).toHaveBeenCalledTimes(2);
    expect(useErrorStore.getState().currentError?.detail).toBe('boom');
    expect(useDemuxStore.getState().isConverting).toBe(false);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('startDemux stops silently when a target is cancelled', async () => {
    const cancelled = new Error('cancelled');
    (cancelled as { code?: string }).code = ErrorCode.CANCELLED;
    convertFileMock.mockRejectedValueOnce(cancelled);
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    await useDemuxStore.getState().startDemux();
    expect(convertFileMock).toHaveBeenCalledTimes(1);
    expect(useErrorStore.getState().currentError).toBeNull();
    expect(useDemuxStore.getState().isConverting).toBe(false);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('emits demux_started and demux_completed analytics when all targets finish', async () => {
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    await useDemuxStore.getState().startDemux();
    const demuxEvents = recordAnalyticsMock.mock.calls.flat().filter((c) => c.name.startsWith('demux_'));
    expect(demuxEvents.map((c) => c.name)).toEqual(['demux_started', 'demux_completed']);
    const [started, completed] = demuxEvents;
    expect(started.props).toEqual({
      kindCounts: { video: 1, audio: 2, subtitle: 1 },
      streamCount: 4,
      convertedKinds: [],
    });
    expect(completed.props).toEqual(
      expect.objectContaining({
        kindCounts: { video: 1, audio: 2, subtitle: 1 },
        streamCount: 4,
        convertedKinds: [],
        durationSec: expect.any(Number),
      }),
    );
  });

  it('emits demux_failed analytics when a target fails', async () => {
    convertFileMock.mockRejectedValueOnce(new Error('boom'));
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    await useDemuxStore.getState().startDemux();
    const demuxEvents = recordAnalyticsMock.mock.calls.flat().filter((c) => c.name.startsWith('demux_'));
    expect(demuxEvents.map((c) => c.name)).toEqual(['demux_started', 'demux_failed']);
    const failed = demuxEvents[1];
    expect(failed.props).toEqual(
      expect.objectContaining({
        code: undefined,
        kindCounts: { video: 1, audio: 2, subtitle: 1 },
        streamCount: 4,
        convertedKinds: [],
      }),
    );
  });

  it('does not emit demux_failed analytics on cancellation', async () => {
    const cancelled = new Error('cancelled');
    (cancelled as { code?: string }).code = ErrorCode.CANCELLED;
    convertFileMock.mockRejectedValueOnce(cancelled);
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    await useDemuxStore.getState().startDemux();
    const demuxEvents = recordAnalyticsMock.mock.calls.flat().filter((c) => c.name.startsWith('demux_'));
    expect(demuxEvents.map((c) => c.name)).toEqual(['demux_started']);
  });

  it('reports re-encoded kinds in the analytics summary', async () => {
    useDemuxStore.setState({
      input: '/in/movie.mkv',
      targets: [{ index: 1, kind: 'audio', map: '0:a:0', copy: false, codec: 'mp3', output: '/in/movie.audio_0.mp3' }],
    });
    await useDemuxStore.getState().startDemux();
    const demuxEvents = recordAnalyticsMock.mock.calls.flat().filter((c) => c.name.startsWith('demux_'));
    expect(demuxEvents.map((c) => c.name)).toEqual(['demux_started', 'demux_completed']);
    const [started, completed] = demuxEvents;
    expect(started.props).toEqual({ kindCounts: { audio: 1 }, streamCount: 1, convertedKinds: ['audio'] });
    expect(completed.props).toEqual(expect.objectContaining({ convertedKinds: ['audio'], durationSec: expect.any(Number) }));
  });

  it('aggregates progress across targets', async () => {
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    const targets = [
      { index: 0, kind: 'video' as const, map: '0:v:0', copy: true, output: '/in/movie.video.mp4' },
      { index: 1, kind: 'audio' as const, map: '0:a:0', copy: true, output: '/in/movie.audio_0.m4a' },
    ];
    useDemuxStore.setState({ targets });

    const pending: Array<() => void> = [];
    convertFileMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          pending.push(resolve);
        }),
    );
    const run = useDemuxStore.getState().startDemux();

    await vi.waitFor(() => expect(pending).toHaveLength(1));
    emitProgress(50, '/in/movie.video.mp4');
    expect(useDemuxStore.getState().progress?.percent).toBe(25);
    emitProgress(0, '/out/movie.video.mp4');
    expect(useDemuxStore.getState().progress?.percent).toBe(25);

    pending[0]?.();
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    emitProgress(50, '/in/movie.audio_0.m4a');
    expect(useDemuxStore.getState().progress?.percent).toBe(75);

    pending[1]?.();
    await run;
    expect(useDemuxStore.getState().isConverting).toBe(false);
    expect(useDemuxStore.getState().progress).toBeNull();
  });

  it('ignores progress events with no active run', () => {
    emitProgress(99);
    expect(useDemuxStore.getState().progress).toBeNull();
  });

  it('pause sets isPaused', async () => {
    await useDemuxStore.getState().pause();
    expect(pauseConversionMock).toHaveBeenCalledOnce();
    expect(useDemuxStore.getState().isPaused).toBe(true);
  });

  it('resume clears isPaused', async () => {
    useDemuxStore.setState({ isPaused: true });
    await useDemuxStore.getState().resume();
    expect(resumeConversionMock).toHaveBeenCalledOnce();
    expect(useDemuxStore.getState().isPaused).toBe(false);
  });

  it('cancel stops the run and clears progress', async () => {
    useDemuxStore.setState({
      isConverting: true,
      isPaused: true,
      progress: { percent: 50, time: '00:00:10', speed: '1x', eta: '10' },
      current: 'audio:1',
    });
    await useDemuxStore.getState().cancel();
    expect(cancelConversionMock).toHaveBeenCalledOnce();
    expect(useDemuxStore.getState().isConverting).toBe(false);
    expect(useDemuxStore.getState().isPaused).toBe(false);
    expect(useDemuxStore.getState().progress).toBeNull();
    expect(useDemuxStore.getState().current).toBeNull();
  });

  it('clearSelection resets the form fields', async () => {
    await useDemuxStore.getState().setInput('/in/movie.mkv');
    useDemuxStore.getState().setMedia({ audioCodec: 'mp3' });
    useDemuxStore.getState().clearSelection();
    const state = useDemuxStore.getState();
    expect(state.input).toBe('');
    expect(state.streams).toEqual([]);
    expect(state.selectedIndices).toEqual([]);
    expect(state.outputDir).toBe('');
    expect(state.targets).toEqual([]);
    expect(state.current).toBeNull();
  });
});
