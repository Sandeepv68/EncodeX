import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRemuxStore } from '../remuxStore';
import { useErrorStore } from '../errorStore';
import { useToastStore } from '../toastStore';
import { ErrorCode } from '../../../shared/errors';
import type { MediaInfo, MediaStreamInfo } from '../../../shared/types';
import { expectAppLog } from '../../../test-utils/crash-tripwire';

const getMediaInfoMock = vi.mocked(window.electronAPI.getMediaInfo);
const convertFileMock = vi.mocked(window.electronAPI.convertFile);
const pauseConversionMock = vi.mocked(window.electronAPI.pauseConversion);
const resumeConversionMock = vi.mocked(window.electronAPI.resumeConversion);
const cancelConversionMock = vi.mocked(window.electronAPI.cancelConversion);
const progressHandler = vi.mocked(window.electronAPI.onConversionProgress).mock.calls[0]?.[0];

function resetStore(): void {
  useRemuxStore.setState({
    input: '',
    container: 'mkv',
    streams: [],
    selectedMaps: [],
    addedSubtitles: [],
    addedAudio: [],
    addedAudioInfo: [],
    thumbnail: null,
    chaptersFile: null,
    copyChapters: true,
    audioSyncSeconds: null,
    videoFilters: [],
    output: '',
    warnings: [],
    isDirty: false,
    isConverting: false,
    isPaused: false,
    progress: null,
  });
  useErrorStore.setState({ currentError: null, errorHistory: [] });
  useToastStore.setState({ toasts: [] });
}

function emitProgress(percent: number): void {
  progressHandler?.({
    input: 'in.mkv',
    output: 'out.mkv',
    progress: { percent, time: '00:00:01', fps: 24, speed: '1x', eta: '5', bitrate: '100k' },
  });
}

const SAMPLE_STREAMS: MediaInfo['streams'] = [
  { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 },
  { index: 1, type: 'audio', codec: 'aac', channels: 2 },
  { index: 2, type: 'subtitle', codec: 'subrip' },
];

const SAMPLE_INFO: MediaInfo = {
  file: 'in.mkv',
  format: 'matroska',
  size: 1024,
  duration: 60,
  bitrate: '1000k',
  streams: SAMPLE_STREAMS,
};

describe('remuxStore', () => {
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
    const state = useRemuxStore.getState();
    expect(state.input).toBe('');
    expect(state.container).toBe('mkv');
    expect(state.streams).toEqual([]);
    expect(state.selectedMaps).toEqual([]);
    expect(state.addedSubtitles).toEqual([]);
    expect(state.addedAudio).toEqual([]);
    expect(state.thumbnail).toBeNull();
    expect(state.chaptersFile).toBeNull();
    expect(state.copyChapters).toBe(true);
    expect(state.audioSyncSeconds).toBeNull();
    expect(state.videoFilters).toEqual([]);
    expect(state.output).toBe('');
    expect(state.warnings).toEqual([]);
    expect(state.isDirty).toBe(false);
    expect(state.isConverting).toBe(false);
    expect(state.isPaused).toBe(false);
    expect(state.progress).toBeNull();
  });

  it('setInput probes the file and populates streams, maps, and output', async () => {
    await useRemuxStore.getState().setInput('in.mkv');
    const state = useRemuxStore.getState();
    expect(getMediaInfoMock).toHaveBeenCalledWith('in.mkv', 'FFMPEG');
    expect(state.input).toBe('in.mkv');
    expect(state.streams).toEqual(SAMPLE_STREAMS);
    expect(state.selectedMaps).toEqual(['0:v:0', '0:a:0', '0:s:0']);
    expect(state.output).toBe('in.mkv');
    expect(state.isDirty).toBe(true);
  });

  it('setInput skips cover-art streams when building maps', async () => {
    getMediaInfoMock.mockResolvedValue({
      ...SAMPLE_INFO,
      streams: [
        { index: 0, type: 'video', codec: 'h264' },
        { index: 1, type: 'video', codec: 'mjpeg', disposition: ['attached_pic'] },
      ],
    });
    await useRemuxStore.getState().setInput('in.mkv');
    expect(useRemuxStore.getState().selectedMaps).toEqual(['0:v:0']);
  });

  it('setInput surfaces a probe failure via the error store', async () => {
    getMediaInfoMock.mockRejectedValue(new Error('probe boom'));
    await useRemuxStore.getState().setInput('in.mkv');
    expect(useErrorStore.getState().currentError?.detail).toBe('probe boom');
    expect(useRemuxStore.getState().input).toBe('');
  });

  it('setContainer re-suggests the output when it still matches the auto-suggest', async () => {
    await useRemuxStore.getState().setInput('in.mkv');
    useRemuxStore.getState().setContainer('mp4');
    const state = useRemuxStore.getState();
    expect(state.container).toBe('mp4');
    expect(state.output).toBe('in.mp4');
    expect(state.isDirty).toBe(true);
  });

  it('setContainer preserves a manually set output path', async () => {
    useRemuxStore.setState({ input: 'in.mkv', output: 'custom/out.mkv' });
    useRemuxStore.getState().setContainer('mp4');
    expect(useRemuxStore.getState().output).toBe('custom/out.mkv');
  });

  it('setContainer recomputes warnings', () => {
    useRemuxStore.setState({
      streams: [{ index: 0, type: 'video', codec: 'theora' }],
      selectedMaps: ['0:v:0'],
    });
    useRemuxStore.getState().setContainer('mp4');
    const warnings = useRemuxStore.getState().warnings;
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].code).toBe('incompatibleVideoStream');
  });

  it('toggleStream adds and removes a map and recomputes warnings', () => {
    const s = useRemuxStore.getState();
    s.toggleStream('0:a:0');
    expect(useRemuxStore.getState().selectedMaps).toEqual(['0:a:0']);
    useRemuxStore.setState({ isDirty: false });
    useRemuxStore.getState().toggleStream('0:a:0');
    expect(useRemuxStore.getState().selectedMaps).toEqual([]);
    expect(useRemuxStore.getState().isDirty).toBe(true);
  });

  it('setAllStreamsSelected selects every source stream or keeps none', () => {
    useRemuxStore.setState({ streams: SAMPLE_STREAMS });
    useRemuxStore.getState().setAllStreamsSelected(true);
    expect(useRemuxStore.getState().selectedMaps).toEqual(['0:v:0', '0:a:0', '0:s:0']);
    useRemuxStore.setState({ isDirty: false });
    useRemuxStore.getState().setAllStreamsSelected(false);
    expect(useRemuxStore.getState().selectedMaps).toEqual([]);
    expect(useRemuxStore.getState().isDirty).toBe(true);
  });

  it('setAllStreamsSelected skips cover-art streams', () => {
    const withCover: MediaInfo['streams'] = [
      { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080 },
      { index: 1, type: 'video', codec: 'mjpeg', disposition: ['attached_pic'] },
    ];
    useRemuxStore.setState({ streams: withCover });
    useRemuxStore.getState().setAllStreamsSelected(true);
    expect(useRemuxStore.getState().selectedMaps).toEqual(['0:v:0']);
  });

  it('adds and removes subtitle and audio tracks', () => {
    const sub = { path: 'sub.srt', map: ['1:0'] };
    const audio = { path: 'audio.m4a', map: ['2:0'] };
    const s = useRemuxStore.getState();
    s.addSubtitleFile(sub);
    s.addAudioFile(audio);
    let state = useRemuxStore.getState();
    expect(state.addedSubtitles).toEqual([sub]);
    expect(state.addedAudio).toEqual([audio]);
    useRemuxStore.getState().removeAddedStream(0);
    state = useRemuxStore.getState();
    expect(state.addedSubtitles).toEqual([]);
    expect(state.addedAudio).toEqual([audio]);
    useRemuxStore.getState().removeAddedStream(0);
    expect(useRemuxStore.getState().addedAudio).toEqual([]);
  });

  it('removeAddedStream ignores out-of-range indices', () => {
    useRemuxStore.setState({ addedSubtitles: [{ path: 'sub.srt', map: ['1:0'] }] });
    useRemuxStore.getState().removeAddedStream(5);
    expect(useRemuxStore.getState().addedSubtitles).toHaveLength(1);
  });

  it('addAudioFile stores the probed audio info and remove keeps the arrays in sync', () => {
    const audio = { path: 'audio.m4a', map: ['2:0'], codec: 'copy' };
    const info = { index: 0, type: 'audio', codec: 'aac', channels: 2, language: 'eng' } as MediaStreamInfo;
    const s = useRemuxStore.getState();
    s.addAudioFile(audio, info);
    let state = useRemuxStore.getState();
    expect(state.addedAudio).toEqual([audio]);
    expect(state.addedAudioInfo).toEqual([info]);
    useRemuxStore.getState().removeAddedStream(0);
    state = useRemuxStore.getState();
    expect(state.addedAudio).toEqual([]);
    expect(state.addedAudioInfo).toEqual([]);
  });

  it('setAddedStreamSync and setAddedStreamCodec address audio via combined index', () => {
    const sub = { path: 'sub.srt', map: ['1:0'], codec: 'subrip' };
    const audio = { path: 'audio.m4a', map: ['2:0'], codec: 'copy' };
    useRemuxStore.setState({ addedSubtitles: [sub], addedAudio: [audio] });
    useRemuxStore.getState().setAddedStreamSync(1, 2);
    useRemuxStore.getState().setAddedStreamCodec(1, 'aac');
    const state = useRemuxStore.getState();
    expect(state.addedAudio[0].syncOffsetSeconds).toBe(2);
    expect(state.addedAudio[0].codec).toBe('aac');
    expect(state.addedSubtitles[0].syncOffsetSeconds).toBeUndefined();
  });

  it('setAddedStreamSync updates subtitle and audio entries by combined index', () => {
    const sub = { path: 'sub.srt', map: ['1:0'] };
    const audio = { path: 'audio.m4a', map: ['2:0'] };
    useRemuxStore.setState({ addedSubtitles: [sub], addedAudio: [audio] });
    useRemuxStore.getState().setAddedStreamSync(0, 1.5);
    useRemuxStore.getState().setAddedStreamSync(1, -0.5);
    const state = useRemuxStore.getState();
    expect(state.addedSubtitles[0].syncOffsetSeconds).toBe(1.5);
    expect(state.addedAudio[0].syncOffsetSeconds).toBe(-0.5);
  });

  it('setAddedStreamCodec updates an added subtitle codec and recomputes warnings', () => {
    useRemuxStore.setState({
      streams: [],
      container: 'mp4',
      addedSubtitles: [{ path: 'sub.ass', map: ['1:0'], codec: 'mov_text' }],
    });
    useRemuxStore.getState().setAddedStreamCodec(0, 'ass');
    const state = useRemuxStore.getState();
    expect(state.addedSubtitles[0].codec).toBe('ass');
    expect(state.isDirty).toBe(true);
    expect(state.warnings.some((w) => w.code === 'addedSubtitleCodecUnsupported')).toBe(true);
  });

  it('setAudioSync, setThumbnail, setChaptersFile, setCopyChapters mark dirty', () => {
    const s = useRemuxStore.getState();
    s.setAudioSync(2);
    expect(useRemuxStore.getState().audioSyncSeconds).toBe(2);
    useRemuxStore.setState({ isDirty: false });
    useRemuxStore.getState().setThumbnail({ path: 'cover.jpg', map: [], attachment: true });
    expect(useRemuxStore.getState().thumbnail?.attachment).toBe(true);
    useRemuxStore.setState({ isDirty: false });
    useRemuxStore.getState().setChaptersFile('chapters.txt');
    expect(useRemuxStore.getState().chaptersFile).toBe('chapters.txt');
    useRemuxStore.setState({ isDirty: false });
    useRemuxStore.getState().setCopyChapters(false);
    expect(useRemuxStore.getState().copyChapters).toBe(false);
    expect(useRemuxStore.getState().isDirty).toBe(true);
  });

  it('setOutput marks dirty', () => {
    useRemuxStore.getState().setOutput('out.mp4');
    expect(useRemuxStore.getState().output).toBe('out.mp4');
    expect(useRemuxStore.getState().isDirty).toBe(true);
  });

  it('setVideoFilters replaces the chain, marks dirty, and recomputes warnings', async () => {
    await useRemuxStore.getState().setInput('in.mkv');
    useRemuxStore.getState().setVideoFilters(['fps=30', 'hue=s=0']);

    const state = useRemuxStore.getState();
    expect(state.videoFilters).toEqual(['fps=30', 'hue=s=0']);
    expect(state.isDirty).toBe(true);
    expect(state.warnings.some((w) => w.code === 'filters_force_reencode')).toBe(true);
  });

  it('setVideoFilters drops the re-encode warning when the chain is emptied', async () => {
    await useRemuxStore.getState().setInput('in.mkv');
    useRemuxStore.getState().setVideoFilters(['fps=30']);
    useRemuxStore.getState().setVideoFilters([]);

    const state = useRemuxStore.getState();
    expect(state.videoFilters).toEqual([]);
    expect(state.warnings.some((w) => w.code === 'filters_force_reencode')).toBe(false);
  });

  it('setVideoFilters copies the array so later caller mutations cannot leak in', () => {
    const chain = ['fps=30'];
    useRemuxStore.getState().setVideoFilters(chain);
    chain.push('hue=s=0');
    expect(useRemuxStore.getState().videoFilters).toEqual(['fps=30']);
  });

  it('updates progress from conversion events while remuxing', () => {
    useRemuxStore.setState({ isConverting: true });
    emitProgress(42);
    expect(useRemuxStore.getState().progress).toMatchObject({ percent: 42, time: '00:00:01', speed: '1x', eta: '5' });
  });

  it('ignores progress events when no remux is running', () => {
    emitProgress(99);
    expect(useRemuxStore.getState().progress).toBeNull();
  });

  it('startRemux shows INPUT_NOT_SPECIFIED without an input', async () => {
    expectAppLog('warn', 'renderer/stores/remuxStore');

    useRemuxStore.setState({ input: '', output: 'out.mkv' });
    await useRemuxStore.getState().startRemux();
    expect(convertFileMock).not.toHaveBeenCalled();
    expect(useErrorStore.getState().currentError?.code).toBe(ErrorCode.INPUT_NOT_SPECIFIED);
  });

  it('startRemux shows OUTPUT_NOT_SPECIFIED without an output', async () => {
    expectAppLog('warn', 'renderer/stores/remuxStore');

    useRemuxStore.setState({
      input: 'in.mkv',
      output: '',
      streams: SAMPLE_STREAMS,
      selectedMaps: ['0:v:0', '0:a:0'],
    });
    await useRemuxStore.getState().startRemux();
    expect(convertFileMock).not.toHaveBeenCalled();
    expect(useErrorStore.getState().currentError?.code).toBe(ErrorCode.OUTPUT_NOT_SPECIFIED);
  });

  it('startRemux runs the conversion with a lossless copy plan', async () => {
    useRemuxStore.setState({
      input: 'in.mkv',
      container: 'mp4',
      output: '/out/out.mp4',
      streams: SAMPLE_STREAMS,
      selectedMaps: ['0:v:0', '0:a:0', '0:s:0'],
    });
    await useRemuxStore.getState().startRemux();
    expect(convertFileMock).toHaveBeenCalledWith(
      'in.mkv',
      '/out/out.mp4',
      expect.objectContaining({
        copy: true,
        map: ['0:v:0', '0:a:0', '0:s:0'],
        copyChapters: true,
      }),
      'FFMPEG',
    );
    expect(useRemuxStore.getState().isConverting).toBe(false);
    expect(useRemuxStore.getState().progress).toBeNull();
    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('startRemux passes added inputs and audio sync into the plan', async () => {
    useRemuxStore.setState({
      input: 'in.mkv',
      output: '/out/out.mkv',
      streams: SAMPLE_STREAMS,
      selectedMaps: ['0:v:0', '0:a:0', '0:s:0'],
      audioSyncSeconds: 1.5,
      addedSubtitles: [{ path: 'sub.srt', map: ['1:0'] }],
    });
    await useRemuxStore.getState().startRemux();
    expect(convertFileMock).toHaveBeenCalledWith(
      'in.mkv',
      '/out/out.mkv',
      expect.objectContaining({
        additionalInputs: expect.arrayContaining([
          { path: 'sub.srt', map: ['1:0'] },
          expect.objectContaining({ path: 'in.mkv', syncOffsetSeconds: 1.5 }),
        ]),
        extraArgs: ['-c:a', 'copy'],
      }),
      'FFMPEG',
    );
  });

  it('startRemux turns the copy into a re-encode and forwards the filter chain', async () => {
    useRemuxStore.setState({
      input: 'in.mkv',
      container: 'mkv',
      output: '/out/out.mkv',
      streams: SAMPLE_STREAMS,
      selectedMaps: ['0:v:0', '0:a:0', '0:s:0'],
      videoFilters: ['fps=30', 'hue=s=0'],
    });
    await useRemuxStore.getState().startRemux();
    expect(convertFileMock).toHaveBeenCalledWith(
      'in.mkv',
      '/out/out.mkv',
      expect.objectContaining({ copy: false, videoFilters: ['fps=30', 'hue=s=0'] }),
      'FFMPEG',
    );
  });

  it('startRemux rejects a hard container incompatibility without converting', async () => {
    useRemuxStore.setState({
      input: 'in.mkv',
      container: 'mp4',
      output: '/out/out.mp4',
      streams: [{ index: 0, type: 'video', codec: 'theora' }],
      selectedMaps: ['0:v:0'],
    });
    await useRemuxStore.getState().startRemux();
    expect(useErrorStore.getState().currentError?.code).toBe(ErrorCode.INCOMPATIBLE_CONTAINER);
    expect(convertFileMock).not.toHaveBeenCalled();
  });

  it('startRemux stores non-blocking warnings from the plan', async () => {
    useRemuxStore.setState({
      input: 'in.mkv',
      container: 'mp4',
      output: '/out/out.mp4',
      streams: [{ index: 0, type: 'video', codec: 'theora' }],
      selectedMaps: [],
    });
    await useRemuxStore.getState().startRemux();
    const warnings = useRemuxStore.getState().warnings;
    expect(warnings.some((w) => w.code === 'incompatibleVideoStream')).toBe(true);
  });

  it('startRemux shows the error when the conversion fails', async () => {
    convertFileMock.mockRejectedValue(new Error('boom'));
    useRemuxStore.setState({
      input: 'in.mkv',
      output: '/out/out.mkv',
      streams: SAMPLE_STREAMS,
      selectedMaps: ['0:v:0', '0:a:0'],
    });
    await useRemuxStore.getState().startRemux();
    expect(useErrorStore.getState().currentError?.detail).toBe('boom');
    expect(useRemuxStore.getState().isConverting).toBe(false);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('startRemux surfaces AUXILIARY_INPUT_NOT_FOUND when an added file is missing', async () => {
    convertFileMock.mockRejectedValue(new Error('An added subtitle, audio, chapter, or cover file could not be found.'));
    useRemuxStore.setState({
      input: 'in.mkv',
      output: '/out/out.mkv',
      streams: SAMPLE_STREAMS,
      selectedMaps: ['0:v:0', '0:a:0'],
      addedSubtitles: [{ path: 'gone.srt', map: ['1:0'] }],
    });
    await useRemuxStore.getState().startRemux();
    expect(useErrorStore.getState().currentError?.code).toBe(ErrorCode.AUXILIARY_INPUT_NOT_FOUND);
    expect(useRemuxStore.getState().isConverting).toBe(false);
  });

  it('pause sets isPaused', async () => {
    await useRemuxStore.getState().pause();
    expect(pauseConversionMock).toHaveBeenCalledOnce();
    expect(useRemuxStore.getState().isPaused).toBe(true);
  });

  it('resume clears isPaused', async () => {
    useRemuxStore.setState({ isPaused: true });
    await useRemuxStore.getState().resume();
    expect(resumeConversionMock).toHaveBeenCalledOnce();
    expect(useRemuxStore.getState().isPaused).toBe(false);
  });

  it('cancel stops the job and clears progress', async () => {
    useRemuxStore.setState({
      isConverting: true,
      isPaused: true,
      progress: { percent: 50, time: '00:00:10', speed: '1x', eta: '10' },
    });
    await useRemuxStore.getState().cancel();
    expect(cancelConversionMock).toHaveBeenCalledOnce();
    expect(useRemuxStore.getState().isConverting).toBe(false);
    expect(useRemuxStore.getState().isPaused).toBe(false);
    expect(useRemuxStore.getState().progress).toBeNull();
  });

  it('clearSelection resets the form but keeps the container and filter chain', async () => {
    await useRemuxStore.getState().setInput('in.mkv');
    useRemuxStore.getState().setContainer('mp4');
    useRemuxStore.getState().addSubtitleFile({ path: 'sub.srt', map: ['1:0'] });
    useRemuxStore.getState().setVideoFilters(['fps=30']);
    useRemuxStore.setState({ isDirty: true });
    useRemuxStore.getState().clearSelection();
    const state = useRemuxStore.getState();
    expect(state.input).toBe('');
    expect(state.streams).toEqual([]);
    expect(state.selectedMaps).toEqual([]);
    expect(state.addedSubtitles).toEqual([]);
    expect(state.addedAudio).toEqual([]);
    expect(state.thumbnail).toBeNull();
    expect(state.chaptersFile).toBeNull();
    expect(state.copyChapters).toBe(true);
    expect(state.audioSyncSeconds).toBeNull();
    expect(state.output).toBe('');
    expect(state.warnings).toEqual([]);
    expect(state.isDirty).toBe(false);
    expect(state.container).toBe('mp4');
    // Like demuxStore, the per-file conversion preferences survive a clear.
    expect(state.videoFilters).toEqual(['fps=30']);
  });
});
