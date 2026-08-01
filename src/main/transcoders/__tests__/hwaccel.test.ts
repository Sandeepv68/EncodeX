import { describe, it, expect } from 'vitest';
import { getHwAccelArgs, isHardwareVideoCodec, HWACCEL } from '../hwaccel';

describe('getHwAccelArgs', () => {
  it('returns no flags for software codecs', () => {
    expect(getHwAccelArgs('libx264')).toEqual([]);
    expect(getHwAccelArgs('libx265')).toEqual([]);
    expect(getHwAccelArgs(undefined)).toEqual([]);
    expect(getHwAccelArgs('')).toEqual([]);
  });

  it('returns cuda flags for NVENC encoders', () => {
    expect(getHwAccelArgs('h264_nvenc')).toEqual(['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda']);
    expect(getHwAccelArgs('hevc_nvenc')).toEqual(['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda']);
    expect(getHwAccelArgs('av1_nvenc')).toEqual(['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda']);
  });

  it('returns qsv flags for QSV encoders', () => {
    expect(getHwAccelArgs('h264_qsv')).toEqual(['-hwaccel', 'qsv', '-hwaccel_output_format', 'qsv']);
    expect(getHwAccelArgs('av1_qsv')).toEqual(['-hwaccel', 'qsv', '-hwaccel_output_format', 'qsv']);
  });

  it('returns d3d11va flags for AMD AMF encoders', () => {
    expect(getHwAccelArgs('h264_amf')).toEqual(['-hwaccel', 'd3d11va']);
  });

  it('returns vaapi device and flags for VAAPI encoders', () => {
    expect(getHwAccelArgs('h264_vaapi')).toEqual([
      '-vaapi_device',
      '/dev/dri/renderD128',
      '-hwaccel',
      'vaapi',
      '-hwaccel_output_format',
      'vaapi',
    ]);
  });

  it('returns videotoolbox flags for VideoToolbox encoders', () => {
    expect(getHwAccelArgs('hevc_videotoolbox')).toEqual(['-hwaccel', 'videotoolbox']);
  });

  it('returns d3d11va flags for Media Foundation encoders', () => {
    expect(getHwAccelArgs('h264_mf')).toEqual(['-hwaccel', 'd3d11va']);
  });

  it('exposes the flags via HWACCEL constants', () => {
    expect(HWACCEL.HWACCEL).toBe('-hwaccel');
    expect(HWACCEL.VAAPI_DEVICE).toBe('-vaapi_device');
  });

  it('returns no flags when hardware acceleration is disabled', () => {
    expect(getHwAccelArgs('h264_nvenc', false)).toEqual([]);
    expect(getHwAccelArgs('hevc_qsv', false, 'auto')).toEqual([]);
  });

  it('returns no flags in encode-only mode', () => {
    expect(getHwAccelArgs('h264_nvenc', true, 'encode')).toEqual([]);
    expect(getHwAccelArgs('h264_nvenc', undefined, 'encode')).toEqual([]);
  });

  it('applies the per-family flags when enabled with automatic mode', () => {
    expect(getHwAccelArgs('h264_nvenc', true, 'auto')).toEqual(['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda']);
  });

  it('treats undefined enabled/mode as enabled with automatic mode', () => {
    expect(getHwAccelArgs('h264_nvenc', undefined, undefined)).toEqual(['-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda']);
  });
});

describe('isHardwareVideoCodec', () => {
  it('recognizes hardware encoder families', () => {
    expect(isHardwareVideoCodec('h264_nvenc')).toBe(true);
    expect(isHardwareVideoCodec('hevc_qsv')).toBe(true);
    expect(isHardwareVideoCodec('av1_amf')).toBe(true);
    expect(isHardwareVideoCodec('vp9_vaapi')).toBe(true);
    expect(isHardwareVideoCodec('prores_videotoolbox')).toBe(true);
    expect(isHardwareVideoCodec('hevc_mf')).toBe(true);
  });

  it('rejects software codecs and unknown names', () => {
    expect(isHardwareVideoCodec('libx264')).toBe(false);
    expect(isHardwareVideoCodec('aac')).toBe(false);
    expect(isHardwareVideoCodec('nvenc')).toBe(false);
    expect(isHardwareVideoCodec(undefined)).toBe(false);
  });
});
