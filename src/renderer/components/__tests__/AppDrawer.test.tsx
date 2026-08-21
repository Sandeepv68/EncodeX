import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AppDrawer from '../AppDrawer';
import { ColorModeProvider } from '../../ColorModeContext';
import { useConversionStore } from '../../stores/conversionStore';
import { useAudioExtractStore } from '../../stores/audioExtractStore';
import { useVideoCutStore } from '../../stores/videoCutStore';
import { useQueueStore } from '../../stores/queueStore';
import { QUEUE_STATUS } from '../../../shared/media-options';

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderDrawer({ isMobile = false, condensed = false, onNavigate = vi.fn(), onToggleCondense = vi.fn() } = {}) {
  return render(
    <MemoryRouter initialEntries={['/convert']}>
      <ColorModeProvider>
        <AppDrawer isMobile={isMobile} condensed={condensed} onToggleCondense={onToggleCondense} onNavigate={onNavigate} />
        <LocationProbe />
      </ColorModeProvider>
    </MemoryRouter>,
  );
}

describe('AppDrawer', () => {
  beforeEach(() => {
    localStorage.clear();
    useConversionStore.getState().resetForm();
    useAudioExtractStore.getState().clearSelection();
    useVideoCutStore.getState().resetForm();
    useConversionStore.getState().setIsConverting(false);
    useVideoCutStore.getState().setIsCutting(false);
    useQueueStore.getState().setJobs([]);
  });

  it('renders the nav items', () => {
    renderDrawer();
    expect(screen.queryByText('app.name')).not.toBeInTheDocument();
    expect(screen.getByText('nav.dashboard')).toBeInTheDocument();
    expect(screen.getByText('nav.convert')).toBeInTheDocument();
    expect(screen.getByText('nav.batchQueue')).toBeInTheDocument();
    expect(screen.getByText('nav.settings')).toBeInTheDocument();
  });

  it('navigates to the clicked route', () => {
    renderDrawer();
    expect(screen.getByTestId('location')).toHaveTextContent('/convert');
    fireEvent.click(screen.getByText('nav.dashboard'));
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });

  it('calls onNavigate on mobile when a nav item is clicked', () => {
    const onNavigate = vi.fn();
    renderDrawer({ isMobile: true, onNavigate });
    fireEvent.click(screen.getByText('nav.logs'));
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it('does not call onNavigate on desktop', () => {
    const onNavigate = vi.fn();
    renderDrawer({ isMobile: false, onNavigate });
    fireEvent.click(screen.getByText('nav.logs'));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('navigates to the settings page when its nav item is clicked', () => {
    renderDrawer();
    fireEvent.click(screen.getByText('nav.settings'));
    expect(screen.getByTestId('location')).toHaveTextContent('/settings');
  });

  it('shows a blip on the convert item while a conversion is in progress', () => {
    useConversionStore.getState().setIsConverting(true);
    renderDrawer();
    expect(screen.getByTestId('nav-convert-blip')).toBeInTheDocument();
  });

  it('hides the blip when no conversion is in progress', () => {
    renderDrawer();
    expect(screen.queryByTestId('nav-convert-blip')).not.toBeInTheDocument();
  });

  it('shows a blip on the video-cut item while a cut is in progress', () => {
    useVideoCutStore.getState().setIsCutting(true);
    renderDrawer();
    expect(screen.getByTestId('nav-video-cut-blip')).toBeInTheDocument();
  });

  it('hides the video-cut blip when no cut is in progress', () => {
    renderDrawer();
    expect(screen.queryByTestId('nav-video-cut-blip')).not.toBeInTheDocument();
  });

  it('counts only active (queued/running) jobs in the batch nav badge', () => {
    useQueueStore.getState().setJobs([
      {
        id: '1',
        input: 'in.mp4',
        output: 'out.mp4',
        options: {},
        transcoder: 'FFMPEG',
        status: QUEUE_STATUS.RUNNING,
        progress: 50,
        createdAt: 1,
      },
      {
        id: '2',
        input: 'in2.mp4',
        output: 'out2.mp4',
        options: {},
        transcoder: 'FFMPEG',
        status: QUEUE_STATUS.QUEUED,
        progress: 0,
        createdAt: 2,
      },
      {
        id: '3',
        input: 'in3.mp4',
        output: 'out3.mp4',
        options: {},
        transcoder: 'FFMPEG',
        status: QUEUE_STATUS.DONE,
        progress: 100,
        createdAt: 3,
      },
    ]);
    renderDrawer();
    expect(screen.getByTestId('nav-batch-blip')).toHaveTextContent('2');
  });

  it('decrements the batch badge as jobs finish', () => {
    const running = {
      id: 'a',
      input: 'a.mp4',
      output: 'out-a.mp4',
      options: {},
      transcoder: 'FFMPEG' as const,
      status: QUEUE_STATUS.RUNNING,
      progress: 100,
      createdAt: 1,
    };
    const queuedB = {
      id: 'b',
      input: 'b.mp4',
      output: 'out-b.mp4',
      options: {},
      transcoder: 'FFMPEG' as const,
      status: QUEUE_STATUS.QUEUED,
      progress: 0,
      createdAt: 2,
    };
    const queuedC = {
      id: 'c',
      input: 'c.mp4',
      output: 'out-c.mp4',
      options: {},
      transcoder: 'FFMPEG' as const,
      status: QUEUE_STATUS.QUEUED,
      progress: 0,
      createdAt: 3,
    };
    useQueueStore.getState().setJobs([running, queuedB, queuedC]);
    renderDrawer();
    expect(screen.getByTestId('nav-batch-blip')).toHaveTextContent('3');
    act(() => {
      useQueueStore.getState().updateJob({ ...running, status: QUEUE_STATUS.DONE });
      useQueueStore.getState().updateJob({ ...queuedB, status: QUEUE_STATUS.RUNNING, progress: 0 });
    });
    expect(screen.getByTestId('nav-batch-blip')).toHaveTextContent('2');
    act(() => {
      useQueueStore.getState().updateJob({ ...queuedB, status: QUEUE_STATUS.DONE });
      useQueueStore.getState().updateJob({ ...queuedC, status: QUEUE_STATUS.RUNNING, progress: 0 });
    });
    expect(screen.getByTestId('nav-batch-blip')).toHaveTextContent('1');
    act(() => {
      useQueueStore.getState().updateJob({ ...queuedC, status: QUEUE_STATUS.DONE });
    });
    expect(screen.queryByTestId('nav-batch-blip')).not.toBeInTheDocument();
  });

  it('hides the batch count badge when only completed jobs remain', () => {
    useQueueStore.getState().setJobs([
      {
        id: '1',
        input: 'in.mp4',
        output: 'out.mp4',
        options: {},
        transcoder: 'FFMPEG',
        status: QUEUE_STATUS.DONE,
        progress: 100,
        createdAt: 1,
      },
      {
        id: '2',
        input: 'in2.mp4',
        output: 'out2.mp4',
        options: {},
        transcoder: 'FFMPEG',
        status: QUEUE_STATUS.ERROR,
        progress: 0,
        createdAt: 2,
      },
    ]);
    renderDrawer();
    expect(screen.queryByTestId('nav-batch-blip')).not.toBeInTheDocument();
  });

  it('hides the batch count badge when the queue is empty', () => {
    useQueueStore.getState().setJobs([]);
    renderDrawer();
    expect(screen.queryByTestId('nav-batch-blip')).not.toBeInTheDocument();
  });

  it('shows the condense button on desktop', () => {
    renderDrawer();
    expect(screen.getByTestId('drawer-condense-button')).toBeInTheDocument();
  });

  it('hides the condense button on mobile', () => {
    renderDrawer({ isMobile: true });
    expect(screen.queryByTestId('drawer-condense-button')).not.toBeInTheDocument();
  });

  it('calls onToggleCondense when the condense button is clicked', () => {
    const onToggleCondense = vi.fn();
    renderDrawer({ onToggleCondense });
    fireEvent.click(screen.getByTestId('drawer-condense-button'));
    expect(onToggleCondense).toHaveBeenCalledOnce();
  });

  it('hides the nav labels when condensed', () => {
    renderDrawer({ condensed: true });
    expect(screen.queryByText('nav.convert')).not.toBeInTheDocument();
    expect(screen.queryByText('nav.dashboard')).not.toBeInTheDocument();
  });

  it('still navigates from the icon when condensed', () => {
    renderDrawer({ condensed: true });
    fireEvent.click(screen.getByTestId('nav-item-dashboard'));
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });

  it('shows the blip on the condensed convert item while a conversion is in progress', () => {
    useConversionStore.getState().setIsConverting(true);
    renderDrawer({ condensed: true });
    expect(screen.getByTestId('nav-convert-blip')).toBeInTheDocument();
  });

  it('shows the batch count badge on the condensed batch item', () => {
    useQueueStore.getState().setJobs([
      {
        id: '1',
        input: 'in.mp4',
        output: 'out.mp4',
        options: {},
        transcoder: 'FFMPEG',
        status: QUEUE_STATUS.RUNNING,
        progress: 50,
        createdAt: 1,
      },
    ]);
    renderDrawer({ condensed: true });
    expect(screen.getByTestId('nav-batch-blip')).toHaveTextContent('1');
  });

  it('opens the convert job popover on hover of its blip with file name and progress', () => {
    useConversionStore.getState().setIsConverting(true);
    useConversionStore.getState().setInputFile('/in/video.mp4');
    useConversionStore.getState().setProgress({ percent: 42, time: '00:00:30', speed: '2.5x', eta: '12' });
    renderDrawer();
    fireEvent.mouseEnter(screen.getByTestId('nav-convert-blip'));
    const popover = screen.getByTestId('nav-job-popover');
    expect(popover).toBeInTheDocument();
    expect(popover).toHaveTextContent('nav.convert');
    expect(popover).toHaveTextContent('Converting');
    expect(popover).toHaveTextContent('video.mp4');
    expect(within(popover).getByRole('progressbar')).toBeInTheDocument();
  });

  it('does not open a popover on hover of a row without a live blip', () => {
    renderDrawer();
    fireEvent.mouseEnter(screen.getByTestId('nav-item-dashboard'));
    expect(screen.queryByTestId('nav-job-popover')).not.toBeInTheDocument();
  });

  it('does not open a popover on hover of the full nav row while a blip is live', () => {
    useConversionStore.getState().setIsConverting(true);
    useConversionStore.getState().setInputFile('/in/video.mp4');
    useConversionStore.getState().setProgress({ percent: 42, time: '00:00:30', speed: '2.5x', eta: '12' });
    renderDrawer();
    fireEvent.mouseEnter(screen.getByTestId('nav-item-convert'));
    expect(screen.queryByTestId('nav-job-popover')).not.toBeInTheDocument();
  });

  it('marks the convert popover as paused while the job is paused', () => {
    useConversionStore.getState().setIsConverting(true);
    useConversionStore.getState().setIsPaused(true);
    useConversionStore.getState().setInputFile('/in/video.mp4');
    useConversionStore.getState().setProgress({ percent: 20, time: '00:00:10', speed: '1x', eta: '50' });
    renderDrawer();
    fireEvent.focus(screen.getByTestId('nav-item-convert'));
    expect(screen.getByTestId('nav-job-popover')).toHaveTextContent('Paused');
  });

  it('opens the audio-extract popover on hover of its blip', () => {
    useAudioExtractStore.setState({
      isConverting: true,
      input: '/in/song.mp4',
      progress: { percent: 7, time: '00:00:05', speed: '3x', eta: '99' },
    });
    renderDrawer();
    fireEvent.mouseEnter(screen.getByTestId('nav-audio-extract-blip'));
    const popover = screen.getByTestId('nav-job-popover');
    expect(popover).toHaveTextContent('nav.audio');
    expect(popover).toHaveTextContent('Extracting audio');
    expect(popover).toHaveTextContent('song.mp4');
    expect(within(popover).getByRole('progressbar')).toBeInTheDocument();
  });

  it('opens the video-cut popover on hover of its blip', () => {
    useVideoCutStore.getState().setIsCutting(true);
    useVideoCutStore.getState().setInput('/in/clip.mkv');
    useVideoCutStore.getState().setProgress({ percent: 63, time: '00:01:00', speed: '2x', eta: '8' });
    renderDrawer();
    fireEvent.mouseEnter(screen.getByTestId('nav-video-cut-blip'));
    const popover = screen.getByTestId('nav-job-popover');
    expect(popover).toHaveTextContent('nav.cut');
    expect(popover).toHaveTextContent('Cutting video');
    expect(popover).toHaveTextContent('clip.mkv');
    expect(within(popover).getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows the batch queue summary and running job progress in its popover', () => {
    useQueueStore.getState().setJobs([
      {
        id: 'job-1',
        input: '/in/run.mp4',
        output: '/out/run.mp4',
        options: {},
        transcoder: 'FFMPEG',
        status: QUEUE_STATUS.RUNNING,
        progress: 55,
        createdAt: 1,
      },
      {
        id: 'job-2',
        input: '/in/queued.mp4',
        output: '/out/queued.mp4',
        options: {},
        transcoder: 'FFMPEG',
        status: QUEUE_STATUS.QUEUED,
        progress: 0,
        createdAt: 2,
      },
      {
        id: 'job-3',
        input: '/in/done.mp4',
        output: '/out/done.mp4',
        options: {},
        transcoder: 'FFMPEG',
        status: QUEUE_STATUS.DONE,
        progress: 100,
        createdAt: 3,
      },
    ]);
    useQueueStore.getState().updateProgress('job-1', { percent: 55, time: '00:00:20', fps: 30, speed: '3.0x', eta: '5', bitrate: '1500k' });
    renderDrawer();
    fireEvent.mouseEnter(screen.getByTestId('nav-batch-blip'));
    const popover = screen.getByTestId('nav-job-popover');
    expect(popover).toHaveTextContent('nav.batchQueue');
    expect(popover).toHaveTextContent('1 queued, 1 running, 1 done, 0 failed');
    expect(popover).toHaveTextContent('run.mp4');
    expect(within(popover).getByRole('progressbar')).toBeInTheDocument();
    const pile = within(popover).getByTestId('nav-job-popover-pile');
    const pileThumbs = within(pile).getAllByTestId('nav-job-popover-pile-thumb');
    expect(pileThumbs).toHaveLength(1);
    expect(pileThumbs[0]).toHaveAttribute('title', 'queued.mp4');
  });

  it('does not open the batch popover when only finished jobs remain', () => {
    useQueueStore.getState().setJobs([
      {
        id: 'job-1',
        input: '/in/done.mp4',
        output: '/out/done.mp4',
        options: {},
        transcoder: 'FFMPEG',
        status: QUEUE_STATUS.DONE,
        progress: 100,
        createdAt: 1,
      },
    ]);
    renderDrawer();
    fireEvent.mouseEnter(screen.getByTestId('nav-item-batch'));
    expect(screen.queryByTestId('nav-job-popover')).not.toBeInTheDocument();
  });

  it('shows the next queued job (not the finished one) in the batch popover while nothing is running', () => {
    useQueueStore.getState().setJobs([
      {
        id: 'job-1',
        input: '/in/done.mp4',
        output: '/out/done.mp4',
        options: {},
        transcoder: 'FFMPEG',
        status: QUEUE_STATUS.DONE,
        progress: 100,
        createdAt: 1,
      },
      {
        id: 'job-2',
        input: '/in/next.mp4',
        output: '/out/next.mp4',
        options: {},
        transcoder: 'FFMPEG',
        status: QUEUE_STATUS.QUEUED,
        progress: 0,
        createdAt: 2,
      },
    ]);
    renderDrawer();
    fireEvent.mouseEnter(screen.getByTestId('nav-batch-blip'));
    const popover = screen.getByTestId('nav-job-popover');
    expect(popover).toHaveTextContent('next.mp4');
    expect(popover).not.toHaveTextContent('done.mp4');
    expect(within(popover).getByRole('progressbar')).toBeInTheDocument();
  });

  it('switches the batch popover to the next running job when the current one finishes', () => {
    useQueueStore.getState().setJobs([
      {
        id: 'job-1',
        input: '/in/first.mp4',
        output: '/out/first.mp4',
        options: {},
        transcoder: 'FFMPEG',
        status: QUEUE_STATUS.RUNNING,
        progress: 100,
        createdAt: 1,
      },
      {
        id: 'job-2',
        input: '/in/second.mp4',
        output: '/out/second.mp4',
        options: {},
        transcoder: 'FFMPEG',
        status: QUEUE_STATUS.QUEUED,
        progress: 0,
        createdAt: 2,
      },
    ]);
    renderDrawer();
    fireEvent.mouseEnter(screen.getByTestId('nav-batch-blip'));
    expect(screen.getByTestId('nav-job-popover')).toHaveTextContent('first.mp4');
    act(() => {
      useQueueStore.getState().updateJob({
        id: 'job-1',
        input: '/in/first.mp4',
        output: '/out/first.mp4',
        options: {},
        transcoder: 'FFMPEG',
        status: QUEUE_STATUS.DONE,
        progress: 100,
        createdAt: 1,
      });
      useQueueStore.getState().updateJob({
        id: 'job-2',
        input: '/in/second.mp4',
        output: '/out/second.mp4',
        options: {},
        transcoder: 'FFMPEG',
        status: QUEUE_STATUS.RUNNING,
        progress: 0,
        createdAt: 2,
      });
    });
    const popover = screen.getByTestId('nav-job-popover');
    expect(popover).toHaveTextContent('second.mp4');
    expect(popover).not.toHaveTextContent('first.mp4');
  });

  it('closes the popover after the pointer leaves the nav row', async () => {
    useConversionStore.getState().setIsConverting(true);
    useConversionStore.getState().setInputFile('/in/video.mp4');
    useConversionStore.getState().setProgress({ percent: 50, time: '00:00:20', speed: '2x', eta: '10' });
    renderDrawer();
    fireEvent.mouseEnter(screen.getByTestId('nav-convert-blip'));
    expect(screen.getByTestId('nav-job-popover')).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByTestId('nav-item-convert'));
    await waitFor(() => expect(screen.queryByTestId('nav-job-popover')).not.toBeInTheDocument(), { timeout: 1000 });
  });
});
