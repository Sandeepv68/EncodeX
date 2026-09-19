import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openFileDialog } from '../fileDialog';

describe('openFileDialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(window.electronAPI.selectFile).mockReset();
  });

  it('calls selectFile with a filter built from the comma-separated accept string', async () => {
    vi.mocked(window.electronAPI.selectFile).mockResolvedValue('/in/video.mp4');
    const file = await openFileDialog('mp4,mkv,mov');
    expect(window.electronAPI.selectFile).toHaveBeenCalledWith([{ name: 'Files', extensions: ['mp4', 'mkv', 'mov'] }]);
    expect(file).toBe('/in/video.mp4');
  });

  it('trims whitespace around each extension', async () => {
    vi.mocked(window.electronAPI.selectFile).mockResolvedValue(null);
    await openFileDialog(' mp4 , mkv ');
    expect(window.electronAPI.selectFile).toHaveBeenCalledWith([{ name: 'Files', extensions: ['mp4', 'mkv'] }]);
  });

  it('opens the dialog without a filter when accept is undefined', async () => {
    vi.mocked(window.electronAPI.selectFile).mockResolvedValue('/in/file.bin');
    const file = await openFileDialog();
    expect(window.electronAPI.selectFile).toHaveBeenCalledWith(undefined);
    expect(file).toBe('/in/file.bin');
  });

  it('returns null when the dialog is cancelled', async () => {
    vi.mocked(window.electronAPI.selectFile).mockResolvedValue(null);
    const file = await openFileDialog('mp4');
    expect(file).toBeNull();
  });

  it('returns null when the preload API is unavailable', async () => {
    const api = window.electronAPI;
    Object.defineProperty(window, 'electronAPI', { value: undefined, writable: true });
    const file = await openFileDialog('mp4');
    expect(file).toBeNull();
    Object.defineProperty(window, 'electronAPI', { value: api, writable: true });
  });
});
