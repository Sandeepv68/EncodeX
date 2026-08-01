import { describe, it, expect, beforeEach } from 'vitest';
import { useConversionStore } from '../conversionStore';

describe('conversionStore', () => {
  beforeEach(() => {
    useConversionStore.setState({
      inputFile: null,
      outputFile: null,
      isConverting: false,
      isPaused: false,
      isDirty: false,
      progress: null,
    });
  });

  it('has default state', () => {
    const state = useConversionStore.getState();
    expect(state.videoCodec).toBe('libx264');
    expect(state.audioCodec).toBe('aac');
    expect(state.qscale).toBe(23);
    expect(state.pixelFormat).toBe('yuv420p');
    expect(state.copyMode).toBe(false);
    expect(state.transcoder).toBe('FFMPEG');
    expect(state.encoderType).toBe('auto');
  });

  it('sets input file', () => {
    useConversionStore.getState().setInputFile('test.mp4');
    expect(useConversionStore.getState().inputFile).toBe('test.mp4');
  });

  it('sets output file', () => {
    useConversionStore.getState().setOutputFile('out.mp4');
    expect(useConversionStore.getState().outputFile).toBe('out.mp4');
  });

  it('sets video codec', () => {
    useConversionStore.getState().setVideoCodec('libx265');
    expect(useConversionStore.getState().videoCodec).toBe('libx265');
  });

  it('sets audio codec', () => {
    useConversionStore.getState().setAudioCodec('libmp3lame');
    expect(useConversionStore.getState().audioCodec).toBe('libmp3lame');
  });

  it('sets video bitrate', () => {
    useConversionStore.getState().setVideoBitrate('1000k');
    expect(useConversionStore.getState().videoBitrate).toBe('1000k');
  });

  it('sets audio bitrate', () => {
    useConversionStore.getState().setAudioBitrate('192k');
    expect(useConversionStore.getState().audioBitrate).toBe('192k');
  });

  it('sets qscale', () => {
    useConversionStore.getState().setQscale(28);
    expect(useConversionStore.getState().qscale).toBe(28);
  });

  it('sets scale', () => {
    useConversionStore.getState().setScale('1280x720');
    expect(useConversionStore.getState().scale).toBe('1280x720');
  });

  it('sets pixel format', () => {
    useConversionStore.getState().setPixelFormat('yuv444p');
    expect(useConversionStore.getState().pixelFormat).toBe('yuv444p');
  });

  it('sets copy mode', () => {
    useConversionStore.getState().setCopyMode(true);
    expect(useConversionStore.getState().copyMode).toBe(true);
  });

  it('sets encoder type', () => {
    useConversionStore.getState().setEncoderType('hardware');
    expect(useConversionStore.getState().encoderType).toBe('hardware');
    expect(useConversionStore.getState().isDirty).toBe(true);
  });

  it('sets transcoder', () => {
    useConversionStore.getState().setTranscoder('FFTOOL');
    expect(useConversionStore.getState().transcoder).toBe('FFTOOL');
  });

  it('sets converting state', () => {
    useConversionStore.getState().setIsConverting(true);
    expect(useConversionStore.getState().isConverting).toBe(true);
  });

  it('sets progress', () => {
    const p = { percent: 50, time: '00:00:30', speed: '1x', eta: '30' };
    useConversionStore.getState().setProgress(p);
    expect(useConversionStore.getState().progress).toEqual(p);
  });

  it('clears progress when set to null', () => {
    useConversionStore.getState().setProgress({ percent: 100, time: 'Done', speed: '-', eta: '0' });
    useConversionStore.getState().setProgress(null);
    expect(useConversionStore.getState().progress).toBeNull();
  });

  it('sets paused state', () => {
    useConversionStore.getState().setIsPaused(true);
    expect(useConversionStore.getState().isPaused).toBe(true);
  });

  it('clears paused state when converting is turned off', () => {
    useConversionStore.getState().setIsPaused(true);
    useConversionStore.getState().setIsConverting(false);
    expect(useConversionStore.getState().isPaused).toBe(false);
    expect(useConversionStore.getState().isConverting).toBe(false);
  });

  it('marks fields dirty when they change', () => {
    expect(useConversionStore.getState().isDirty).toBe(false);
    useConversionStore.getState().setVideoCodec('libx265');
    expect(useConversionStore.getState().isDirty).toBe(true);
  });

  it('resets the form to initial state', () => {
    useConversionStore.getState().setVideoCodec('libx265');
    useConversionStore.getState().setScale('1280x720');
    useConversionStore.getState().setProgress({ percent: 10, time: '00:00:01', speed: '1x', eta: '1' });
    useConversionStore.getState().setIsConverting(true);
    useConversionStore.getState().resetForm();
    const state = useConversionStore.getState();
    expect(state.videoCodec).toBe('libx264');
    expect(state.scale).toBe('1920x1080');
    expect(state.progress).toBeNull();
    expect(state.isConverting).toBe(false);
    expect(state.isDirty).toBe(false);
  });
});
