import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRANSCODER_COMMANDS } from '../../../shared/transcoder-constants';
import { expectAppLog } from '../../../test-utils/crash-tripwire';

const { spawnSyncMock } = vi.hoisted(() => ({ spawnSyncMock: vi.fn() }));

vi.mock('child_process', () => ({
  spawnSync: spawnSyncMock,
  default: { spawnSync: spawnSyncMock },
}));

const { checkBmfAvailable } = await import('../bmf-availability');

const FFMPEG = TRANSCODER_COMMANDS.BMF_FFMPEG;
const FFPROBE = TRANSCODER_COMMANDS.BMF_FFPROBE;
const originalPlatform = process.platform;

/**
 * Overrides `process.platform` for the lifetime of a test.
 * @param {NodeJS.Platform} platform - Platform value to report.
 * @returns {void}
 */
function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
}

describe('checkBmfAvailable', () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
  });

  afterEach(() => {
    setPlatform(originalPlatform);
  });

  it('reports available when both tools resolve through which', () => {
    setPlatform('linux');
    spawnSyncMock.mockReturnValue({ status: 0, stdout: '/usr/bin/bmf_ffmpeg\n' });

    expect(checkBmfAvailable()).toEqual({ available: true, missing: [] });
    expect(spawnSyncMock).toHaveBeenCalledWith('which', [FFMPEG], expect.any(Object));
    expect(spawnSyncMock).toHaveBeenCalledWith('which', [FFPROBE], expect.any(Object));
  });

  it('uses where on Windows', () => {
    setPlatform('win32');
    spawnSyncMock.mockReturnValue({ status: 0, stdout: 'C:\\tools\\bmf_ffmpeg.exe\r\n' });

    expect(checkBmfAvailable()).toEqual({ available: true, missing: [] });
    expect(spawnSyncMock).toHaveBeenCalledWith('where', [FFMPEG], expect.any(Object));
  });

  it('lists only the tools that failed the lookup and logs a warning', () => {
    setPlatform('linux');
    spawnSyncMock.mockImplementation((_lookup: string, args: string[]) =>
      args[0] === FFMPEG ? { status: 0, stdout: '/usr/bin/bmf_ffmpeg' } : { status: 1, stdout: '' },
    );
    expectAppLog('warn', 'main/transcoders/bmf-availability');

    expect(checkBmfAvailable()).toEqual({ available: false, missing: [FFPROBE] });
  });

  it('treats a missing or blank stdout as unavailable', () => {
    setPlatform('linux');
    spawnSyncMock.mockReturnValue({ status: 0 });

    expect(checkBmfAvailable()).toEqual({ available: false, missing: [FFMPEG, FFPROBE] });

    spawnSyncMock.mockReturnValue({ status: 0, stdout: '   ' });
    expectAppLog('warn', 'main/transcoders/bmf-availability');
    expect(checkBmfAvailable()).toEqual({ available: false, missing: [FFMPEG, FFPROBE] });
  });
});
