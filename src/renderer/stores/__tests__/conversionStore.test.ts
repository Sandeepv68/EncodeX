import { describe, it, expect, beforeEach } from 'vitest';
import { useConversionStore } from '../conversionStore';

describe('conversionStore', () => {
  beforeEach(() => {
    useConversionStore.setState({
      inputFile: null,
      outputFile: null,
      isConverting: false,
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
});
