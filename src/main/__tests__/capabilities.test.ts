import { describe, it, expect, vi, beforeEach } from 'vitest';

const { spawnSyncMock, getFfmpegPathMock } = vi.hoisted(() => ({
  spawnSyncMock: vi.fn(),
  getFfmpegPathMock: vi.fn(() => 'C:/static/ffmpeg.exe'),
}));

vi.mock('child_process', () => ({
  spawnSync: spawnSyncMock,
  default: { spawnSync: spawnSyncMock },
}));
vi.mock('../transcoders/ffmpeg-utils', () => ({ getFfmpegPath: getFfmpegPathMock }));

const { parseEncoderOutput, parseHwaccelOutput, getEncoderCapabilities } = await import('../capabilities');

const ENCODERS_OUT = `
Encoders:
 V.....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
 V....D h264_nvenc            NVIDIA NVENC H.264 encoder (codec h264)
 V....D av1_qsv               AV1 (Intel Quick Sync Video acceleration) (codec av1)
 A....D aac                   AAC (Advanced Audio Coding) (codec aac)
 A....D libfdk_aac            Fraunhofer FDK AAC (codec aac)
 S..... mov_text              MOV text
`;

const HWACCELS_OUT = `Hardware acceleration methods:
cuda
dxva2
qsv
d3d11va
`;

describe('parseEncoderOutput', () => {
  it('parses video and audio encoder names from ffmpeg -encoders output', () => {
    const { videoEncoders, audioEncoders } = parseEncoderOutput(ENCODERS_OUT);
    expect(videoEncoders).toContain('libx264');
    expect(videoEncoders).toContain('h264_nvenc');
    expect(videoEncoders).toContain('av1_qsv');
    expect(audioEncoders).toContain('aac');
    expect(audioEncoders).toContain('libfdk_aac');
    expect(videoEncoders).not.toContain('mov_text');
    expect(audioEncoders).not.toContain('mov_text');
  });

  it('handles empty or malformed output', () => {
    expect(parseEncoderOutput('')).toEqual({ videoEncoders: [], audioEncoders: [] });
    expect(parseEncoderOutput('Encoders:\n')).toEqual({ videoEncoders: [], audioEncoders: [] });
  });

  it('handles Windows CRLF line endings', () => {
    const { videoEncoders } = parseEncoderOutput('Encoders:\r\n V.....D libx264 x\r\n');
    expect(videoEncoders).toEqual(['libx264']);
  });
});

describe('parseHwaccelOutput', () => {
  it('parses the hwaccel list, skipping the header line', () => {
    expect(parseHwaccelOutput(HWACCELS_OUT)).toEqual(['cuda', 'dxva2', 'qsv', 'd3d11va']);
  });

  it('parses a space-separated hwaccel list', () => {
    expect(parseHwaccelOutput('Hardware acceleration methods:\ncuda dxva2 qsv')).toEqual(['cuda', 'dxva2', 'qsv']);
  });

  it('returns an empty list for empty output', () => {
    expect(parseHwaccelOutput('')).toEqual([]);
  });
});

describe('getEncoderCapabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spawnSyncMock.mockReset();
  });

  it('probes ffmpeg once, caches the result, and returns parsed capabilities', () => {
    spawnSyncMock
      .mockReturnValueOnce({ error: null, status: 0, stdout: ENCODERS_OUT })
      .mockReturnValueOnce({ error: null, status: 0, stdout: HWACCELS_OUT });

    const first = getEncoderCapabilities();
    const second = getEncoderCapabilities();

    expect(getFfmpegPathMock).toHaveBeenCalled();
    expect(spawnSyncMock).toHaveBeenCalledTimes(2);
    expect(first).toEqual({
      videoEncoders: expect.arrayContaining(['libx264', 'h264_nvenc', 'av1_qsv']),
      audioEncoders: expect.arrayContaining(['aac', 'libfdk_aac']),
      hwaccels: ['cuda', 'dxva2', 'qsv', 'd3d11va'],
    });
    expect(second).toBe(first);
  });

  it('passes -hide_banner -encoders and -hwaccels to the bundled binary', () => {
    spawnSyncMock
      .mockReturnValueOnce({ error: null, status: 0, stdout: ENCODERS_OUT })
      .mockReturnValueOnce({ error: null, status: 0, stdout: HWACCELS_OUT });

    getEncoderCapabilities(true);

    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      'C:/static/ffmpeg.exe',
      ['-hide_banner', '-encoders'],
      expect.objectContaining({ encoding: 'utf-8', timeout: expect.any(Number), windowsHide: true }),
    );
    expect(spawnSyncMock).toHaveBeenNthCalledWith(2, 'C:/static/ffmpeg.exe', ['-hide_banner', '-hwaccels'], expect.anything());
  });

  it('returns null when ffmpeg exits with a non-zero code', () => {
    spawnSyncMock.mockReturnValue({ error: null, status: 1, stdout: '' });
    expect(getEncoderCapabilities(true)).toBeNull();
  });

  it('returns null when the probe throws', () => {
    spawnSyncMock.mockImplementation(() => {
      throw new Error('spawn boom');
    });
    expect(getEncoderCapabilities(true)).toBeNull();
  });
});
