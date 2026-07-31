import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MediaPlayer from '../MediaPlayer';
import type { MediaInfo } from '../../../shared/types';

const playerOpen = vi.mocked(window.electronAPI.playerOpen);
const getMediaInfo = vi.mocked(window.electronAPI.getMediaInfo);
const playerClose = vi.mocked(window.electronAPI.playerClose);
const playerSeek = vi.mocked(window.electronAPI.playerSeek);
const onPlayerFrame = vi.mocked(window.electronAPI.onPlayerFrame);

function mediaInfo(duration: number): MediaInfo {
  return { file: 'v.mp4', format: 'mp4', size: 0, duration, bitrate: '', streams: [] };
}

describe('MediaPlayer', () => {
  beforeEach(() => {
    playerOpen.mockClear();
    playerClose.mockClear();
    playerSeek.mockClear();
    getMediaInfo.mockReset();
    onPlayerFrame.mockReset();
    onPlayerFrame.mockReturnValue(vi.fn());
  });

  it('opens the player and requests media info on mount', () => {
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    const { unmount } = render(<MediaPlayer filePath="/v.mp4" />);
    expect(playerOpen).toHaveBeenCalledWith('/v.mp4');
    expect(getMediaInfo).toHaveBeenCalledWith('/v.mp4', 'FFMPEG');
    expect(onPlayerFrame).toHaveBeenCalledOnce();
    unmount();
  });

  it('displays the duration once media info is loaded', async () => {
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    render(<MediaPlayer filePath="/v.mp4" />);
    expect(await screen.findByText(/1:00/)).toBeInTheDocument();
  });

  it('closes the player on unmount', () => {
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    const { unmount } = render(<MediaPlayer filePath="/v.mp4" />);
    unmount();
    expect(playerClose).toHaveBeenCalled();
  });

  it('pauses on canvas click and resumes by reopening the player', () => {
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    const { container } = render(<MediaPlayer filePath="/v.mp4" />);
    const canvas = container.querySelector('canvas')!;
    expect(container.querySelector('[data-testid="PauseIcon"]')).not.toBeNull();
    fireEvent.click(canvas);
    expect(container.querySelector('[data-testid="PlayArrowIcon"]')).not.toBeNull();
    fireEvent.click(canvas);
    expect(playerOpen).toHaveBeenCalledTimes(2);
  });

  it('stops playback and closes the player', () => {
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    const { container } = render(<MediaPlayer filePath="/v.mp4" />);
    playerClose.mockClear();
    fireEvent.click(container.querySelector('[data-testid="StopIcon"]')!);
    expect(playerClose).toHaveBeenCalledOnce();
    expect(container.querySelector('[data-testid="PlayArrowIcon"]')).not.toBeNull();
  });

  it('seeks the player when the slider is committed', async () => {
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    const { container } = render(<MediaPlayer filePath="/v.mp4" />);
    await screen.findByText(/1:00/);
    const sliderInput = container.querySelector('input[type="range"]')!;
    fireEvent.keyDown(sliderInput, { key: 'ArrowRight' });
    expect(playerSeek).toHaveBeenCalled();
  });
});
