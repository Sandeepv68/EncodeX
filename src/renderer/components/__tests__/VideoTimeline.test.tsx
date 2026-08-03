import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  it('renders nothing when the duration is unknown', () => {
    const { container } = render(
      <VideoTimeline duration={0} currentTime={0} start={0} end={0} onSeek={vi.fn()} onStartChange={vi.fn()} onEndChange={vi.fn()} />,
    );
    expect(container.querySelector('[data-testid="timeline-scroller"]')).toBeNull();
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
    const kept = screen.getByTestId('timeline-kept-region');
    const dimmed = screen.getAllByTestId('timeline-dimmed-region');
    expect(kept).toHaveStyle({ top: '2px', bottom: '2px' });
    for (const region of dimmed) {
      expect(region).toHaveStyle({ top: '2px', bottom: '2px' });
    }
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
});
