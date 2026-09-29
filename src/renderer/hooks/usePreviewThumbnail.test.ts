import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePreviewThumbnail } from './usePreviewThumbnail';
import { clearPreviewCache } from '../utils/preview-cache';

const getVideoPreviewMock = vi.mocked(window.electronAPI.getVideoPreview);

describe('usePreviewThumbnail', () => {
  beforeEach(() => {
    clearPreviewCache();
    getVideoPreviewMock.mockReset();
    getVideoPreviewMock.mockResolvedValue(null);
  });

  it('resolves the preview data URL for a video path', async () => {
    getVideoPreviewMock.mockResolvedValue('data:image/png;base64,FRAME');
    const { result } = renderHook(() => usePreviewThumbnail('/in/clip.mkv'));
    await waitFor(() => expect(result.current).toBe('data:image/png;base64,FRAME'));
    expect(getVideoPreviewMock).toHaveBeenCalledWith('/in/clip.mkv');
  });

  it('stays null for a falsy path and never calls the preview IPC', async () => {
    const { result } = renderHook(() => usePreviewThumbnail(undefined));
    expect(result.current).toBeNull();
    expect(getVideoPreviewMock).not.toHaveBeenCalled();
  });

  it('clears the preview when the path is removed', async () => {
    getVideoPreviewMock.mockResolvedValue('data:image/png;base64,FRAME');
    const { result, rerender } = renderHook(({ path }: { path?: string }) => usePreviewThumbnail(path), {
      initialProps: { path: '/in/clip.mkv' as string | undefined },
    });
    await waitFor(() => expect(result.current).toBe('data:image/png;base64,FRAME'));

    rerender({ path: undefined });
    expect(result.current).toBeNull();
  });

  it('ignores a late result for a path that is no longer current', async () => {
    // One pending promise per path, so only the abandoned request resolves
    // after the path changes.
    const pending = new Map<string, { resolve: (value: string | null) => void }>();
    getVideoPreviewMock.mockImplementation(
      (filePath: string) =>
        new Promise<string | null>((resolve) => {
          pending.set(filePath, { resolve });
        }),
    );
    const { result, rerender } = renderHook(({ path }: { path?: string }) => usePreviewThumbnail(path), {
      initialProps: { path: '/in/first.mkv' as string | undefined },
    });
    await waitFor(() => expect(pending.has('/in/first.mkv')).toBe(true));

    rerender({ path: '/in/second.mkv' });
    await waitFor(() => expect(pending.has('/in/second.mkv')).toBe(true));

    pending.get('/in/first.mkv')?.resolve('data:image/png;base64,STALE');
    await Promise.resolve();
    expect(result.current).toBeNull();
  });
});
