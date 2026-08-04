import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import VideoTimeline from '../VideoTimeline';
import { TIMELINE_LAYOUT } from '../../styles/VideoTimeline.styles';

function mockRect(el: HTMLElement, left: number, width: number) {
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({
      left,
      top: 0,
      right: left + width,
      bottom: 0,
      width,
      height: 0,
      x: left,
      y: 0,
      toJSON: () => ({}),
    }),
  });
}

describe('VideoTimeline', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders the ruler, lane, trim handles, and playhead', () => {
    render(
      <VideoTimeline duration={60} currentTime={10} start={5} end={50} onSeek={vi.fn()} onStartChange={vi.fn()} onEndChange={vi.fn()} />,
    );
    expect(screen.getByTestId('timeline-scroller')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-start-handle')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-end-handle')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-playhead')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-current-time')).toHaveTextContent('00:00:10 / 00:01:00');
  });

  it('renders start and end time bubbles on the ruler aligned with the trim markers', () => {
    render(
      <VideoTimeline duration={60} currentTime={0} start={5} end={50} onSeek={vi.fn()} onStartChange={vi.fn()} onEndChange={vi.fn()} />,
    );
    const startBubble = screen.getByTestId('timeline-start-time');
    const endBubble = screen.getByTestId('timeline-end-time');
    expect(startBubble).toHaveTextContent('00:00:05');
    expect(endBubble).toHaveTextContent('00:00:50');
    expect(startBubble).toHaveStyle({ left: '50px' });
    expect(endBubble).toHaveStyle({ left: '500px' });
    expect(startBubble).toHaveStyle({ transform: 'translateX(-50%)' });
  });

  it('slides the bubbles as the trim markers move', () => {
    const onStartChange = vi.fn();
    const onEndChange = vi.fn();
    function Harness() {
      const [start, setStart] = useState(5);
      const [end, setEnd] = useState(50);
      return (
        <VideoTimeline
          duration={60}
          currentTime={0}
          start={start}
          end={end}
          onSeek={vi.fn()}
          onStartChange={(v) => {
            setStart(v);
            onStartChange(v);
          }}
          onEndChange={(v) => {
            setEnd(v);
            onEndChange(v);
          }}
        />
      );
    }
    render(<Harness />);
    const scroller = screen.getByTestId('timeline-scroller');
    mockRect(scroller, 0, 600);

    const startHandle = screen.getByTestId('timeline-start-handle');
    fireEvent.pointerDown(startHandle, { clientX: 50 });
    fireEvent.pointerMove(window, { clientX: 200 });
    fireEvent.pointerUp(window);
    expect(screen.getByTestId('timeline-start-time')).toHaveTextContent('00:00:20');
    expect(screen.getByTestId('timeline-start-time')).toHaveStyle({ left: '200px' });

    const endHandle = screen.getByTestId('timeline-end-handle');
    fireEvent.pointerDown(endHandle, { clientX: 500 });
    fireEvent.pointerMove(window, { clientX: 400 });
    fireEvent.pointerUp(window);
    expect(screen.getByTestId('timeline-end-time')).toHaveTextContent('00:00:40');
    expect(screen.getByTestId('timeline-end-time')).toHaveStyle({ left: '400px' });
  });

  it('renders nothing when the duration is unknown', () => {
    const { container } = render(
      <VideoTimeline duration={0} currentTime={0} start={0} end={0} onSeek={vi.fn()} onStartChange={vi.fn()} onEndChange={vi.fn()} />,
    );
    expect(container.querySelector('[data-testid="timeline-scroller"]')).toBeNull();
  });

  it('renders a persistent shadow pinned to the left edge of the scroller', () => {
    render(
      <VideoTimeline duration={60} currentTime={0} start={0} end={60} onSeek={vi.fn()} onStartChange={vi.fn()} onEndChange={vi.fn()} />,
    );
    const shadow = screen.getByTestId('timeline-scroll-shadow');
    expect(shadow).toHaveStyle({ position: 'sticky', left: '0px', width: '24px' });
    expect(shadow.parentElement).toHaveStyle({
      position: 'absolute',
      top: '0px',
      height: `${TIMELINE_LAYOUT.RULER_HEIGHT + TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT + TIMELINE_LAYOUT.AUDIO_TRACK_HEIGHT}px`,
    });
  });

  it('seeks when the lane is clicked', () => {
    const onSeek = vi.fn();
    render(
      <VideoTimeline duration={60} currentTime={0} start={0} end={60} onSeek={onSeek} onStartChange={vi.fn()} onEndChange={vi.fn()} />,
    );
    const scroller = screen.getByTestId('timeline-scroller');
    mockRect(scroller, 0, 600);
    fireEvent.pointerDown(scroller, { clientX: 300 });
    expect(onSeek).toHaveBeenCalledWith(30);
  });

  it('updates the start time when the start handle is dragged', () => {
    const onStartChange = vi.fn();
    render(
      <VideoTimeline
        duration={60}
        currentTime={0}
        start={0}
        end={60}
        onSeek={vi.fn()}
        onStartChange={onStartChange}
        onEndChange={vi.fn()}
      />,
    );
    const scroller = screen.getByTestId('timeline-scroller');
    mockRect(scroller, 0, 600);
    const handle = screen.getByTestId('timeline-start-handle');
    fireEvent.pointerDown(handle, { clientX: 0 });
    fireEvent.pointerMove(window, { clientX: 10 });
    fireEvent.pointerUp(window);
    expect(onStartChange).toHaveBeenCalledWith(1);
  });

  it('updates the end time when the end handle is dragged', () => {
    const onEndChange = vi.fn();
    render(
      <VideoTimeline duration={60} currentTime={0} start={0} end={60} onSeek={vi.fn()} onStartChange={vi.fn()} onEndChange={onEndChange} />,
    );
    const scroller = screen.getByTestId('timeline-scroller');
    mockRect(scroller, 0, 600);
    const handle = screen.getByTestId('timeline-end-handle');
    fireEvent.pointerDown(handle, { clientX: 600 });
    fireEvent.pointerMove(window, { clientX: 590 });
    fireEvent.pointerUp(window);
    expect(onEndChange).toHaveBeenCalledWith(59);
  });

  it('clamps the start handle so it cannot pass the end handle', () => {
    const onStartChange = vi.fn();
    render(
      <VideoTimeline
        duration={60}
        currentTime={0}
        start={10}
        end={40}
        onSeek={vi.fn()}
        onStartChange={onStartChange}
        onEndChange={vi.fn()}
      />,
    );
    const scroller = screen.getByTestId('timeline-scroller');
    mockRect(scroller, 0, 600);
    const handle = screen.getByTestId('timeline-start-handle');
    fireEvent.pointerDown(handle, { clientX: 100 });
    fireEvent.pointerMove(window, { clientX: 500 });
    fireEvent.pointerUp(window);
    expect(onStartChange).toHaveBeenCalledWith(39.9);
  });

  it('clamps the end handle so it cannot pass the start handle', () => {
    const onEndChange = vi.fn();
    render(
      <VideoTimeline
        duration={60}
        currentTime={0}
        start={10}
        end={40}
        onSeek={vi.fn()}
        onStartChange={vi.fn()}
        onEndChange={onEndChange}
      />,
    );
    const scroller = screen.getByTestId('timeline-scroller');
    mockRect(scroller, 0, 600);
    const handle = screen.getByTestId('timeline-end-handle');
    fireEvent.pointerDown(handle, { clientX: 400 });
    fireEvent.pointerMove(window, { clientX: 0 });
    fireEvent.pointerUp(window);
    expect(onEndChange).toHaveBeenCalledWith(10.1);
  });

  it('shows a move cursor and a centered move indicator on the kept region', () => {
    render(
      <VideoTimeline duration={60} currentTime={0} start={10} end={40} onSeek={vi.fn()} onStartChange={vi.fn()} onEndChange={vi.fn()} />,
    );
    const region = screen.getByTestId('timeline-kept-region');
    expect(region).toHaveStyle({ cursor: 'move' });
    const indicator = screen.getByTestId('timeline-move-indicator');
    expect(indicator).toHaveStyle({ opacity: '0' });
    expect(indicator.parentElement).toBe(region);
  });

  it('slides the kept region when dragged', () => {
    const onStartChange = vi.fn();
    const onEndChange = vi.fn();
    render(
      <VideoTimeline
        duration={60}
        currentTime={0}
        start={10}
        end={40}
        onSeek={vi.fn()}
        onStartChange={onStartChange}
        onEndChange={onEndChange}
      />,
    );
    const scroller = screen.getByTestId('timeline-scroller');
    mockRect(scroller, 0, 600);
    const region = screen.getByTestId('timeline-kept-region');
    fireEvent.pointerDown(region, { clientX: 250 });
    fireEvent.pointerMove(window, { clientX: 300 });
    fireEvent.pointerUp(window);
    expect(onStartChange).toHaveBeenCalledWith(15);
    expect(onEndChange).toHaveBeenCalledWith(45);
  });

  it('clamps the kept region when dragged past the timeline edges', () => {
    const onStartChange = vi.fn();
    const onEndChange = vi.fn();
    render(
      <VideoTimeline
        duration={60}
        currentTime={0}
        start={10}
        end={40}
        onSeek={vi.fn()}
        onStartChange={onStartChange}
        onEndChange={onEndChange}
      />,
    );
    const scroller = screen.getByTestId('timeline-scroller');
    mockRect(scroller, 0, 600);
    const region = screen.getByTestId('timeline-kept-region');
    fireEvent.pointerDown(region, { clientX: 250 });
    fireEvent.pointerMove(window, { clientX: 0 });
    expect(onStartChange).toHaveBeenLastCalledWith(0);
    expect(onEndChange).toHaveBeenLastCalledWith(30);
    fireEvent.pointerMove(window, { clientX: 600 });
    expect(onStartChange).toHaveBeenLastCalledWith(30);
    expect(onEndChange).toHaveBeenLastCalledWith(60);
    fireEvent.pointerUp(window);
  });

  it('scrubs the playhead while dragging', () => {
    const onSeek = vi.fn();
    render(
      <VideoTimeline duration={60} currentTime={0} start={0} end={60} onSeek={onSeek} onStartChange={vi.fn()} onEndChange={vi.fn()} />,
    );
    const scroller = screen.getByTestId('timeline-scroller');
    mockRect(scroller, 0, 600);
    const playhead = screen.getByTestId('timeline-playhead');
    fireEvent.pointerDown(playhead, { clientX: 0 });
    fireEvent.pointerMove(window, { clientX: 300 });
    fireEvent.pointerMove(window, { clientX: 450 });
    fireEvent.pointerUp(window);
    expect(onSeek).toHaveBeenNthCalledWith(1, 30);
    expect(onSeek).toHaveBeenNthCalledWith(2, 45);
  });

  it('tracks the cursor when dragging the end handle on a horizontally scrolled timeline', () => {
    const onEndChange = vi.fn();
    render(
      <VideoTimeline
        duration={600}
        currentTime={0}
        start={0}
        end={600}
        onSeek={vi.fn()}
        onStartChange={vi.fn()}
        onEndChange={onEndChange}
      />,
    );
    const scroller = screen.getByTestId('timeline-scroller');
    mockRect(scroller, -400, 1200);
    const viewport = scroller.parentElement as HTMLElement;
    Object.defineProperty(viewport, 'scrollLeft', { value: 400, configurable: true });
    const handle = screen.getByTestId('timeline-end-handle');
    fireEvent.pointerDown(handle, { clientX: 800 });
    fireEvent.pointerMove(window, { clientX: 700 });
    fireEvent.pointerUp(window);
    expect(onEndChange).toHaveBeenCalledWith(550);
  });

  it('renders an audio waveform track when waveform data is provided', () => {
    render(
      <VideoTimeline
        duration={60}
        currentTime={0}
        start={5}
        end={50}
        waveform={{
          sampleRate: 8000,
          samplesPerBucket: 1000,
          buckets: [
            { min: -1, max: 1 },
            { min: -0.5, max: 0.5 },
          ],
        }}
        onSeek={vi.fn()}
        onStartChange={vi.fn()}
        onEndChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('timeline-audio-track')).toBeInTheDocument();
    expect(screen.getAllByTestId('timeline-waveform-bar')).toHaveLength(2);
  });

  it('aggregates waveform buckets into clearly separated bars when zoomed out', () => {
    render(
      <VideoTimeline
        duration={300}
        currentTime={0}
        start={0}
        end={300}
        waveform={{
          sampleRate: 8000,
          samplesPerBucket: 1000,
          buckets: Array.from({ length: 1200 }, () => ({ min: -1, max: 1 })),
        }}
        onSeek={vi.fn()}
        onStartChange={vi.fn()}
        onEndChange={vi.fn()}
      />,
    );
    const bars = screen.getAllByTestId('timeline-waveform-bar');
    expect(bars.length).toBeGreaterThan(0);
    expect(bars.length).toBeLessThan(1200);
    const lefts = bars.map((bar) => Number(getComputedStyle(bar).left.replace('px', '')));
    expect(lefts.every((x) => Number.isInteger(x))).toBe(true);
    for (let i = 1; i < lefts.length; i++) {
      expect(lefts[i] - lefts[i - 1]).toBeGreaterThanOrEqual(4);
    }
  });

  it('vertically aligns the waveform and thumbnail strips within their tracks', () => {
    render(
      <VideoTimeline
        duration={30}
        currentTime={0}
        start={5}
        end={50}
        waveform={{
          sampleRate: 8000,
          samplesPerBucket: 1000,
          buckets: [{ min: -1, max: 1 }],
        }}
        thumbnails={{
          dataUrl: 'data:image/png;base64,AAAA',
          cols: 2,
          rows: 2,
          thumbWidth: 160,
          thumbHeight: 90,
          interval: 7.5,
          count: 1,
        }}
        onSeek={vi.fn()}
        onStartChange={vi.fn()}
        onEndChange={vi.fn()}
      />,
    );
    const bar = screen.getAllByTestId('timeline-waveform-bar')[0];
    const cell = screen.getAllByTestId('timeline-thumb')[0];
    expect(bar).toHaveStyle({ top: '2px', height: `${TIMELINE_LAYOUT.TRACK_CONTENT_HEIGHT}px` });
    expect(cell).toHaveStyle({ top: '2px' });
    expect(TIMELINE_LAYOUT.TRACK_CONTENT_HEIGHT + TIMELINE_LAYOUT.TRACK_CONTENT_TOP * 2).toBe(TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT);
    expect(TIMELINE_LAYOUT.AUDIO_TRACK_HEIGHT).toBe(TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT);
    const audioTrack = screen.getByTestId('timeline-audio-track');
    expect(audioTrack).toHaveStyle({ backgroundColor: '#809dca42' });
    const kept = screen.getByTestId('timeline-kept-region');
    const dimmed = screen.getAllByTestId('timeline-dimmed-region');
    expect(kept).toHaveStyle({ top: '2px', bottom: '2px' });
    for (const region of dimmed) {
      expect(region).toHaveStyle({ top: '2px', bottom: '2px' });
    }
  });

  it('renders fixed video and audio track labels', () => {
    render(
      <VideoTimeline duration={60} currentTime={0} start={0} end={60} onSeek={vi.fn()} onStartChange={vi.fn()} onEndChange={vi.fn()} />,
    );
    const videoLabel = screen.getByTestId('timeline-video-label');
    const audioLabel = screen.getByTestId('timeline-audio-label');
    expect(videoLabel).toBeInTheDocument();
    expect(audioLabel).toBeInTheDocument();
    expect(getComputedStyle(videoLabel).height).toBe(`${TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT}px`);
    expect(getComputedStyle(audioLabel).height).toBe(`${TIMELINE_LAYOUT.AUDIO_TRACK_HEIGHT}px`);
    const viewport = screen.getByTestId('timeline-scroller').parentElement as HTMLElement;
    const panel = videoLabel.parentElement as HTMLElement;
    expect(panel).not.toBe(viewport);
  });

  it('renders the audio-enabled checkbox checked by default', () => {
    render(
      <VideoTimeline duration={60} currentTime={0} start={0} end={60} onSeek={vi.fn()} onStartChange={vi.fn()} onEndChange={vi.fn()} />,
    );
    const checkbox = screen.getByTestId('timeline-audio-enabled') as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();
    expect(checkbox).toHaveAccessibleName('videoTimeline.audioEnabled');
  });

  it('toggles audio via the audio-enabled checkbox', () => {
    const onAudioEnabledChange = vi.fn();
    render(
      <VideoTimeline
        duration={60}
        currentTime={0}
        start={0}
        end={60}
        audioEnabled={true}
        onAudioEnabledChange={onAudioEnabledChange}
        onSeek={vi.fn()}
        onStartChange={vi.fn()}
        onEndChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('timeline-audio-enabled'));
    expect(onAudioEnabledChange).toHaveBeenCalledWith(false);
  });

  it('renders a video thumbnails track when thumbnail data is provided', () => {
    render(
      <VideoTimeline
        duration={60}
        currentTime={0}
        start={5}
        end={50}
        thumbnails={{
          dataUrl: 'data:image/png;base64,AAAA',
          cols: 2,
          rows: 2,
          thumbWidth: 160,
          thumbHeight: 90,
          interval: 7.5,
          count: 3,
        }}
        onSeek={vi.fn()}
        onStartChange={vi.fn()}
        onEndChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('timeline-video-track')).toBeInTheDocument();
    expect(screen.getAllByTestId('timeline-thumb')).toHaveLength(3);
  });

  it('renders skeletons in both tracks and a generating hint while loading', () => {
    render(
      <VideoTimeline
        duration={60}
        currentTime={0}
        start={5}
        end={50}
        waveformLoading
        thumbnailsLoading
        onSeek={vi.fn()}
        onStartChange={vi.fn()}
        onEndChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('timeline-thumb-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-waveform-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-generating')).toBeInTheDocument();
    expect(screen.queryByTestId('timeline-thumb')).not.toBeInTheDocument();
    expect(screen.queryByTestId('timeline-waveform-bar')).not.toBeInTheDocument();
  });

  it('shows only the waveform skeleton when only the waveform is loading', () => {
    render(
      <VideoTimeline
        duration={60}
        currentTime={0}
        start={5}
        end={50}
        waveformLoading
        thumbnails={{
          dataUrl: 'data:image/png;base64,AAAA',
          cols: 2,
          rows: 2,
          thumbWidth: 160,
          thumbHeight: 90,
          interval: 7.5,
          count: 2,
        }}
        onSeek={vi.fn()}
        onStartChange={vi.fn()}
        onEndChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('timeline-waveform-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('timeline-thumb-skeleton')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('timeline-thumb')).toHaveLength(2);
  });

  it('zooms in and out with the zoom buttons', () => {
    render(
      <VideoTimeline duration={60} currentTime={0} start={0} end={60} onSeek={vi.fn()} onStartChange={vi.fn()} onEndChange={vi.fn()} />,
    );
    const scroller = screen.getByTestId('timeline-scroller');
    expect(scroller.style.width).toBe('600px');
    fireEvent.click(screen.getByLabelText('videoTimeline.zoomIn'));
    expect(scroller.style.width).toBe('900px');
    fireEvent.click(screen.getByLabelText('videoTimeline.zoomOut'));
    expect(scroller.style.width).toBe('600px');
  });

  it('always shows a one-line video stream bubble pinned to the top-left of the video track', () => {
    render(
      <VideoTimeline
        duration={60}
        currentTime={0}
        start={0}
        end={60}
        videoStream={{ index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080, bitrate: '4500000' }}
        onSeek={vi.fn()}
        onStartChange={vi.fn()}
        onEndChange={vi.fn()}
      />,
    );
    const bubble = screen.getByTestId('timeline-video-tooltip');
    expect(bubble).toHaveTextContent('h264 · 1920×1080 · 4.5 Mbps');
    expect(bubble).toHaveStyle({ position: 'sticky', left: '0px' });
    expect(bubble.parentElement).toHaveStyle({ top: '0px', paddingTop: '2px' });
  });

  it('always shows a one-line audio stream bubble pinned to the top-left of the audio track', () => {
    render(
      <VideoTimeline
        duration={60}
        currentTime={0}
        start={0}
        end={60}
        audioStream={{ index: 1, type: 'audio', codec: 'aac', channels: 2, channelLayout: 'stereo', sampleRate: 48000, bitrate: '128000' }}
        onSeek={vi.fn()}
        onStartChange={vi.fn()}
        onEndChange={vi.fn()}
      />,
    );
    const bubble = screen.getByTestId('timeline-audio-tooltip');
    expect(bubble).toHaveTextContent('aac · stereo · 48 kHz · 128 kbps');
    expect(bubble).toHaveStyle({ position: 'sticky', left: '0px' });
    expect(bubble.parentElement).toHaveStyle({ top: `${TIMELINE_LAYOUT.VIDEO_TRACK_HEIGHT}px`, paddingTop: '2px' });
  });

  it('renders no stream bubble when no stream info is provided', () => {
    render(
      <VideoTimeline duration={60} currentTime={0} start={0} end={60} onSeek={vi.fn()} onStartChange={vi.fn()} onEndChange={vi.fn()} />,
    );
    expect(screen.queryByTestId('timeline-video-tooltip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('timeline-audio-tooltip')).not.toBeInTheDocument();
  });
});
