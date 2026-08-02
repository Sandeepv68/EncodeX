import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MediaPlayer from '../MediaPlayer';
import type { MediaInfo } from '../../../shared/types';

const playerOpen = vi.mocked(window.electronAPI.playerOpen);
const getMediaInfo = vi.mocked(window.electronAPI.getMediaInfo);
const playerClose = vi.mocked(window.electronAPI.playerClose);
const playerSeek = vi.mocked(window.electronAPI.playerSeek);
const onPlayerFrame = vi.mocked(window.electronAPI.onPlayerFrame);
const onPlayerAudio = vi.mocked(window.electronAPI.onPlayerAudio);

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
    onPlayerAudio.mockReset();
    onPlayerAudio.mockReturnValue(vi.fn());
  });

  it('requests media info without autoplaying on mount', () => {
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    const { unmount } = render(<MediaPlayer filePath="/v.mp4" />);
    expect(playerOpen).not.toHaveBeenCalled();
    expect(getMediaInfo).toHaveBeenCalledWith('/v.mp4', 'FFMPEG');
    expect(onPlayerFrame).toHaveBeenCalledOnce();
    expect(onPlayerAudio).toHaveBeenCalledOnce();
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

  it('starts paused and toggles playback on click', () => {
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    const { container } = render(<MediaPlayer filePath="/v.mp4" />);
    const canvas = container.querySelector('canvas')!;
    expect(container.querySelector('[data-icon="play"]')).not.toBeNull();
    fireEvent.click(canvas);
    expect(playerOpen).toHaveBeenCalledOnce();
    expect(container.querySelector('[data-icon="pause"]')).not.toBeNull();
    fireEvent.click(canvas);
    expect(playerClose).toHaveBeenCalledOnce();
    expect(container.querySelector('[data-icon="play"]')).not.toBeNull();
  });

  it('stops playback and closes the player', () => {
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    const { container } = render(<MediaPlayer filePath="/v.mp4" />);
    playerClose.mockClear();
    fireEvent.click(container.querySelector('[data-icon="stop"]')!);
    expect(playerClose).toHaveBeenCalledOnce();
    expect(container.querySelector('[data-icon="play"]')).not.toBeNull();
  });

  it('seeks the player when the slider is committed', async () => {
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    const { container } = render(<MediaPlayer filePath="/v.mp4" />);
    await screen.findByText(/1:00/);
    const sliderInput = container.querySelector('input[type="range"]')!;
    fireEvent.keyDown(sliderInput, { key: 'ArrowRight' });
    expect(playerSeek).toHaveBeenCalled();
  });

  it('renders a mute button that toggles its icon', () => {
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    const { container } = render(<MediaPlayer filePath="/v.mp4" />);
    expect(container.querySelector('[data-icon="volume-high"]')).not.toBeNull();
    fireEvent.click(container.querySelector('button[aria-label="mute"]')!);
    expect(container.querySelector('[data-icon="volume-xmark"]')).not.toBeNull();
    fireEvent.click(container.querySelector('button[aria-label="unmute"]')!);
    expect(container.querySelector('[data-icon="volume-high"]')).not.toBeNull();
  });
});
