import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRef } from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import MediaPlayer from '../MediaPlayer';
import type { MediaPlayerHandle } from '../types';
import type { MediaInfo, PlayerFrame } from '../../../shared/types';
import { assertNoAxeViolations } from '../../../test-utils/axe';

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

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('has no axe violations', async () => {
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    const { container } = render(<MediaPlayer filePath="/v.mp4" />);
    await assertNoAxeViolations(container);
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

  it('closes the decoder after drawing the first frame on stop', async () => {
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    playerSeek.mockResolvedValue(2 as never);
    let frameCb: ((frame: PlayerFrame) => void) | null = null;
    onPlayerFrame.mockImplementation((cb: (frame: PlayerFrame) => void) => {
      frameCb = cb;
      return vi.fn();
    });
    const { container } = render(<MediaPlayer filePath="/v.mp4" />);
    fireEvent.click(container.querySelector('[data-icon="stop"]')!);
    playerClose.mockClear();
    await act(async () => {});
    frameCb!({
      data: new Uint8Array(4).buffer,
      width: 1,
      height: 1,
      pts: 0,
      generation: 2,
    } as PlayerFrame);
    expect(playerClose).toHaveBeenCalledOnce();
  });

  it('ignores stale frames from an earlier generation after a seek', async () => {
    vi.useFakeTimers();
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    playerOpen.mockResolvedValue(1 as never);
    playerSeek.mockResolvedValue(2 as never);
    const onTimeUpdate = vi.fn();
    const ref = createRef<MediaPlayerHandle>();
    let frameCb: ((frame: PlayerFrame) => void) | null = null;
    onPlayerFrame.mockImplementation((cb: (frame: PlayerFrame) => void) => {
      frameCb = cb;
      return vi.fn();
    });
    let rafCb: FrameRequestCallback | null = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCb = cb;
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const runRaf = () => {
      act(() => {
        rafCb?.call(window, 0);
      });
    };

    const { container } = render(<MediaPlayer filePath="/v.mp4" ref={ref} onTimeUpdate={onTimeUpdate} />);
    fireEvent.click(container.querySelector('canvas')!);
    await act(async () => {});
    frameCb!({
      data: new Uint8Array(4).buffer,
      width: 1,
      height: 1,
      pts: 1,
      generation: 1,
    } as PlayerFrame);
    act(() => {
      ref.current?.seekTo(5);
    });
    act(() => {
      vi.advanceTimersByTime(120);
    });
    await act(async () => {});
    frameCb!({
      data: new Uint8Array(4).buffer,
      width: 1,
      height: 1,
      pts: 1.5,
      generation: 1,
    } as PlayerFrame);
    frameCb!({
      data: new Uint8Array(4).buffer,
      width: 1,
      height: 1,
      pts: 5,
      generation: 2,
    } as PlayerFrame);
    runRaf();
    expect(onTimeUpdate).toHaveBeenCalledWith(5);
    expect(onTimeUpdate).not.toHaveBeenCalledWith(1.5);
    expect(onTimeUpdate).not.toHaveBeenCalledWith(1);
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
    fireEvent.click(container.querySelector('button[aria-label="player.mute"]')!);
    expect(container.querySelector('[data-icon="volume-xmark"]')).not.toBeNull();
    fireEvent.click(container.querySelector('button[aria-label="player.unmute"]')!);
    expect(container.querySelector('[data-icon="volume-high"]')).not.toBeNull();
  });

  it('exposes accessible names for the transport controls and seek slider', () => {
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    render(<MediaPlayer filePath="/v.mp4" />);
    expect(screen.getByRole('button', { name: 'player.play' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'player.stop' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'player.seek' })).toBeInTheDocument();
  });

  it('reports the duration via onDurationChange once media info is loaded', async () => {
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    const onDurationChange = vi.fn();
    render(<MediaPlayer filePath="/v.mp4" onDurationChange={onDurationChange} />);
    await waitFor(() => expect(onDurationChange).toHaveBeenCalledWith(60));
  });

  it('exposes a seekTo handle that seeks and starts playback', () => {
    vi.useFakeTimers();
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    const ref = createRef<MediaPlayerHandle>();
    const { container } = render(<MediaPlayer filePath="/v.mp4" ref={ref} />);
    act(() => {
      ref.current?.seekTo(5);
    });
    expect(playerSeek).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(120);
    });
    expect(playerSeek).toHaveBeenCalledWith('00:00:05.000');
    expect(container.querySelector('[data-icon="pause"]')).not.toBeNull();
  });

  it('baselines the media clock to the first frame pts for files with a start offset', async () => {
    vi.useFakeTimers();
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    playerOpen.mockResolvedValue(1 as never);
    const onTimeUpdate = vi.fn();
    let frameCb: ((frame: PlayerFrame) => void) | null = null;
    onPlayerFrame.mockImplementation((cb: (frame: PlayerFrame) => void) => {
      frameCb = cb;
      return vi.fn();
    });
    let rafCb: FrameRequestCallback | null = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCb = cb;
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const runRaf = () => {
      act(() => {
        rafCb?.call(window, 0);
      });
    };

    const { container } = render(<MediaPlayer filePath="/v.mp4" onTimeUpdate={onTimeUpdate} />);
    fireEvent.click(container.querySelector('canvas')!);
    await act(async () => {});
    act(() => {
      frameCb!({
        data: new Uint8Array(4).buffer,
        width: 1,
        height: 1,
        pts: 0.6,
        generation: 1,
      } as PlayerFrame);
    });
    runRaf();
    expect(onTimeUpdate).toHaveBeenCalledWith(0.6);
  });

  it('catches audio up to the clock after a stall instead of permanently lagging', async () => {
    vi.useFakeTimers();
    getMediaInfo.mockResolvedValue(mediaInfo(60));
    playerOpen.mockResolvedValue(1 as never);

    const ctx = {
      currentTime: 0,
      state: 'running',
      destination: {},
      sources: [] as Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }>,
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      createGain: () => ({ gain: { value: 1 }, connect: vi.fn() }),
      createBuffer: vi.fn((ch: number, frames: number, sr: number) => ({
        duration: frames / sr,
        getChannelData: () => new Float32Array(frames),
      })),
      createBufferSource: vi.fn(() => {
        const source = { start: vi.fn(), stop: vi.fn(), connect: vi.fn(), onended: null };
        ctx.sources.push(source);
        return source;
      }),
    };
    class AudioContextMock {
      constructor() {
        return ctx;
      }
    }
    (window as unknown as { AudioContext: typeof AudioContext }).AudioContext = AudioContextMock as unknown as typeof AudioContext;

    let audioCb: ((chunk: import('../../../shared/types').PlayerAudioChunk) => void) | null = null;
    onPlayerAudio.mockImplementation((cb) => {
      audioCb = cb;
      return vi.fn();
    });

    const { container } = render(<MediaPlayer filePath="/v.mp4" />);
    fireEvent.click(container.querySelector('canvas')!);
    await act(async () => {});

    const chunk = () => new Int16Array(4800).buffer;
    ctx.currentTime = 0;
    act(() => {
      audioCb!({ data: chunk(), sampleRate: 48000, channels: 2, generation: 1 });
    });
    expect(ctx.sources[0].start).toHaveBeenCalledWith(0.1);

    ctx.currentTime = 1.5;
    act(() => {
      audioCb!({ data: chunk(), sampleRate: 48000, channels: 2, generation: 1 });
    });
    const last = ctx.sources[ctx.sources.length - 1];
    expect(last.start).toHaveBeenCalledWith(1.5);
  });
});
