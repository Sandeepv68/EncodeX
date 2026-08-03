import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MediaPlayer from '../MediaPlayer';
import type { MediaInfo, PlayerFrame } from '../../../shared/types';

const playerOpen = vi.mocked(window.electronAPI.playerOpen);
const getMediaInfo = vi.mocked(window.electronAPI.getMediaInfo);
const playerClose = vi.mocked(window.electronAPI.playerClose);
const playerSeek = vi.mocked(window.electronAPI.playerSeek);
const onPlayerFrame = vi.mocked(window.electronAPI.onPlayerFrame);
const onPlayerAudio = vi.mocked(window.electronAPI.onPlayerAudio);

function mediaInfo(duration: number): MediaInfo {
  return { file: 'v.mp4', format: 'mp4', size: 0, duration, bitrate: '', streams: [] };
}

function stubCanvasContext() {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => {
    return {
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
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
    stubCanvasContext();
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

  it('stops playback, resets the position, and reloads the start frame', () => {
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    const { container } = render(<MediaPlayer filePath="/v.mp4" />);
    playerClose.mockClear();
    fireEvent.click(container.querySelector('[data-icon="stop"]')!);
    expect(playerSeek).toHaveBeenCalledWith('00:00:00');
    const sliderInput = container.querySelector('input[type="range"]')!;
    expect((sliderInput as HTMLInputElement).value).toBe('0');
    expect(container.querySelector('[data-icon="play"]')).not.toBeNull();
  });

  it('closes the decoder after drawing the first frame on stop', () => {
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    let frameCb: ((frame: PlayerFrame) => void) | null = null;
    onPlayerFrame.mockImplementation((cb: (frame: PlayerFrame) => void) => {
      frameCb = cb;
      return vi.fn();
    });
    const { container } = render(<MediaPlayer filePath="/v.mp4" />);
    fireEvent.click(container.querySelector('[data-icon="stop"]')!);
    playerClose.mockClear();
    frameCb!({
      data: new Uint8Array(4).buffer,
      width: 1,
      height: 1,
      pts: 0,
    } as PlayerFrame);
    expect(playerClose).toHaveBeenCalledOnce();
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

  it('does not render cut markers unless marker callbacks are provided', () => {
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    render(<MediaPlayer filePath="/v.mp4" />);
    expect(screen.queryByLabelText('cut start marker')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('cut end marker')).not.toBeInTheDocument();
  });

  it('renders cut markers when callbacks are provided', () => {
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    render(<MediaPlayer filePath="/v.mp4" onStartMarkerChange={() => {}} onEndMarkerChange={() => {}} />);
    expect(screen.getByLabelText('cut start marker')).toBeInTheDocument();
    expect(screen.getByLabelText('cut end marker')).toBeInTheDocument();
  });

  it('reports marker changes when the end marker is moved', async () => {
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    const onStart = vi.fn();
    const onEnd = vi.fn();
    render(<MediaPlayer filePath="/v.mp4" startMarker={10} endMarker={40} onStartMarkerChange={onStart} onEndMarkerChange={onEnd} />);
    const endMarker = screen.getByLabelText('cut end marker');
    await waitFor(() => expect((endMarker as HTMLInputElement).value).toBe('40'));
    fireEvent.keyDown(endMarker, { key: 'ArrowLeft' });
    expect(onEnd).toHaveBeenCalledWith(39);
    expect(onStart).not.toHaveBeenCalled();
  });
});
