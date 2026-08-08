import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QueueJobCard from '../QueueJobCard';
import { useToastStore } from '../../stores/toastStore';
import { QUEUE_STATUS } from '../../../shared/media-options';
import type { QueueJob } from '../../../shared/types';

const revealFileMock = vi.mocked(window.electronAPI.revealFile);
const getVideoPreviewMock = vi.mocked(window.electronAPI.getVideoPreview);
const getImagePreviewMock = vi.mocked(window.electronAPI.getImagePreview);

function makeJob(overrides: Partial<QueueJob> = {}): QueueJob {
  return {
    id: 'j1',
    input: 'C:/videos/clip.mp4',
    output: 'C:/videos/clip_out.mp4',
    options: {},
    transcoder: 'FFMPEG',
    status: QUEUE_STATUS.QUEUED,
    progress: 0,
    createdAt: 1,
    ...overrides,
  };
}

describe('QueueJobCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('renders the file basename and output path inside the details', () => {
    render(<QueueJobCard job={makeJob()} onRemove={() => {}} />);
    expect(screen.getByText('clip.mp4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'batchQueue.expandDetails' })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.expandDetails' }));
    expect(screen.getByText('batchQueue.detailsOutput')).toBeInTheDocument();
    expect(screen.getByText('C:/videos/clip_out.mp4')).toBeInTheDocument();
  });

  it('renders the status chip', () => {
    render(<QueueJobCard job={makeJob({ status: QUEUE_STATUS.DONE })} onRemove={() => {}} />);
    expect(screen.getByText(QUEUE_STATUS.DONE)).toBeInTheDocument();
    expect(screen.getByText(QUEUE_STATUS.DONE).closest('.MuiChip-root')).toHaveClass('MuiChip-colorSuccess');
  });

  it('calls onRemove with the job id', () => {
    const onRemove = vi.fn();
    render(<QueueJobCard job={makeJob()} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.remove' }));
    expect(onRemove).toHaveBeenCalledWith('j1');
  });

  it('renders progress for running jobs', () => {
    render(<QueueJobCard job={makeJob({ status: QUEUE_STATUS.RUNNING, progress: 50 })} onRemove={() => {}} />);
    expect(screen.getByText('50.0%')).toBeInTheDocument();
  });

  it('renders live time/speed/eta captions from the progress snapshot', () => {
    render(
      <QueueJobCard
        job={makeJob({ status: QUEUE_STATUS.RUNNING, progress: 50 })}
        progress={{ percent: 50, time: '00:00:05', fps: 30, speed: '2.5x', eta: '12', bitrate: '1500k' }}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText('Time: 00:00:05')).toBeInTheDocument();
    expect(screen.getByText('Speed: 2.5x')).toBeInTheDocument();
    expect(screen.getByText('ETA: 12s')).toBeInTheDocument();
  });

  it('omits the eta caption when the progress snapshot has a zero eta', () => {
    render(
      <QueueJobCard
        job={makeJob({ status: QUEUE_STATUS.RUNNING, progress: 50 })}
        progress={{ percent: 50, time: '00:00:05', fps: 30, speed: '2.5x', eta: '0', bitrate: '1500k' }}
        onRemove={() => {}}
      />,
    );
    expect(screen.queryByText(/ETA/)).not.toBeInTheDocument();
  });

  it('does not render progress for non-running jobs', () => {
    render(<QueueJobCard job={makeJob({ status: QUEUE_STATUS.QUEUED, progress: 50 })} onRemove={() => {}} />);
    expect(screen.queryByText('50.0%')).not.toBeInTheDocument();
  });

  it('renders the error text when present', () => {
    render(<QueueJobCard job={makeJob({ error: 'something broke' })} onRemove={() => {}} />);
    const inlineErrors = screen.getAllByText('something broke').filter((el) => el.closest('.MuiCollapse-root') === null);
    expect(inlineErrors).toHaveLength(1);
  });

  it('renders a retry button for errored jobs when onRetry is provided', () => {
    render(<QueueJobCard job={makeJob({ status: QUEUE_STATUS.ERROR })} onRemove={() => {}} onRetry={() => {}} />);
    expect(screen.getByRole('button', { name: 'batchQueue.retry' })).toBeInTheDocument();
  });

  it('calls onRetry with the full job when retry is clicked', () => {
    const onRetry = vi.fn();
    const failedJob = makeJob({ status: QUEUE_STATUS.ERROR });
    render(<QueueJobCard job={failedJob} onRemove={() => {}} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.retry' }));
    expect(onRetry).toHaveBeenCalledWith(failedJob);
  });

  it('omits the retry button for errored jobs without an onRetry handler', () => {
    render(<QueueJobCard job={makeJob({ status: QUEUE_STATUS.ERROR })} onRemove={() => {}} />);
    expect(screen.queryByRole('button', { name: 'batchQueue.retry' })).not.toBeInTheDocument();
  });

  it('falls back to the full path when no directory separator is present', () => {
    render(<QueueJobCard job={makeJob({ input: 'clip.mp4' })} onRemove={() => {}} />);
    expect(screen.getByText('clip.mp4')).toBeInTheDocument();
  });

  it('shows a tooltip with the full input path when the filename is hovered', async () => {
    render(<QueueJobCard job={makeJob()} onRemove={() => {}} />);
    fireEvent.mouseOver(screen.getByText('clip.mp4'));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('C:/videos/clip.mp4');
  });

  it('reveals the output file in the OS file manager', async () => {
    render(<QueueJobCard job={makeJob()} onRemove={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.revealInFolder' }));
    await vi.waitFor(() => expect(revealFileMock).toHaveBeenCalledWith('C:/videos/clip_out.mp4'));
  });

  it('copies the output path to the clipboard and shows a success toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<QueueJobCard job={makeJob()} onRemove={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.copyPath' }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('C:/videos/clip_out.mp4'));
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success' && t.message === 'toast.pathCopied')).toBe(true);
  });

  it('renders reorder arrows for queued jobs when onMove is provided', () => {
    render(<QueueJobCard job={makeJob()} onRemove={() => {}} onMove={() => {}} />);
    expect(screen.getByRole('button', { name: 'batchQueue.moveUp' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'batchQueue.moveDown' })).toBeInTheDocument();
  });

  it('omits reorder arrows for non-queued jobs', () => {
    render(<QueueJobCard job={makeJob({ status: QUEUE_STATUS.RUNNING })} onRemove={() => {}} onMove={() => {}} />);
    expect(screen.queryByRole('button', { name: 'batchQueue.moveUp' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'batchQueue.moveDown' })).not.toBeInTheDocument();
  });

  it('omits reorder arrows for queued jobs without an onMove handler', () => {
    render(<QueueJobCard job={makeJob()} onRemove={() => {}} />);
    expect(screen.queryByRole('button', { name: 'batchQueue.moveUp' })).not.toBeInTheDocument();
  });

  it('calls onMove with the job id and direction when an arrow is clicked', () => {
    const onMove = vi.fn();
    render(<QueueJobCard job={makeJob()} onRemove={() => {}} onMove={onMove} />);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.moveUp' }));
    expect(onMove).toHaveBeenCalledWith('j1', -1);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.moveDown' }));
    expect(onMove).toHaveBeenCalledWith('j1', 1);
  });

  it('renders a details toggle button that starts collapsed', () => {
    render(<QueueJobCard job={makeJob()} onRemove={() => {}} />);
    const toggle = screen.getByRole('button', { name: 'batchQueue.expandDetails' });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('batchQueue.detailsOptions')).not.toBeInTheDocument();
  });

  it('expands to show the option summary, transcoder and creation time', () => {
    const createdAt = Date.UTC(2024, 0, 15, 10, 30, 0);
    render(
      <QueueJobCard
        job={makeJob({
          createdAt,
          options: {
            videoCodec: 'libx264',
            audioCodec: 'aac',
            videoBitrate: '2000k',
            scale: '1280x720',
            hardwareAcceleration: true,
            hwaccelMode: 'auto',
          },
        })}
        onRemove={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.expandDetails' }));
    expect(screen.getByText('batchQueue.detailsOutput')).toBeInTheDocument();
    expect(screen.getByText('C:/videos/clip_out.mp4')).toBeInTheDocument();
    expect(screen.getByText('batchQueue.detailsOptions')).toBeInTheDocument();
    expect(screen.getByText('libx264')).toBeInTheDocument();
    expect(screen.getByText('aac')).toBeInTheDocument();
    expect(screen.getByText('2000k')).toBeInTheDocument();
    expect(screen.getByText('1280x720')).toBeInTheDocument();
    expect(screen.getByText('batchQueue.yes')).toBeInTheDocument();
    expect(screen.getByText('auto')).toBeInTheDocument();
    expect(screen.getByText(/batchQueue\.detailsTranscoder/)).toBeInTheDocument();
    expect(screen.getByText('FFMPEG')).toBeInTheDocument();
    expect(screen.getByText(new Date(createdAt).toLocaleString())).toBeInTheDocument();
  });

  it('flips the toggle to collapsed state when clicked again', () => {
    render(<QueueJobCard job={makeJob()} onRemove={() => {}} />);
    const toggle = screen.getByRole('button', { name: 'batchQueue.expandDetails' });
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'batchQueue.collapseDetails' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.collapseDetails' }));
    expect(screen.queryByText('batchQueue.detailsOptions')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'batchQueue.collapseDetails' })).not.toBeInTheDocument();
  });

  it('shows the full error under a label when expanded and inline when collapsed', () => {
    render(<QueueJobCard job={makeJob({ error: 'something broke' })} onRemove={() => {}} />);
    const inlineErrors = screen.getAllByText('something broke').filter((el) => el.closest('.MuiCollapse-root') === null);
    expect(inlineErrors).toHaveLength(1);
    expect(screen.getByText('batchQueue.detailsError')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.expandDetails' }));
    expect(screen.getByText('batchQueue.detailsError')).toBeInTheDocument();
    expect(screen.getAllByText('something broke')).toHaveLength(1);
  });

  it('hides the inline error once expanded so it only appears in the details panel', () => {
    render(<QueueJobCard job={makeJob({ error: 'boom' })} onRemove={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.expandDetails' }));
    expect(screen.getAllByText('boom')).toHaveLength(1);
    expect(screen.getByText('batchQueue.detailsError')).toBeInTheDocument();
  });

  it('shows a trim row combining start and end times', () => {
    render(<QueueJobCard job={makeJob({ options: { startTime: '00:01:00', endTime: '00:02:00' } })} onRemove={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.expandDetails' }));
    expect(screen.getByText('00:01:00 \u2192 00:02:00')).toBeInTheDocument();
  });

  it('renders a video thumbnail fetched from the video preview API', async () => {
    getVideoPreviewMock.mockResolvedValue('data:image/png;base64,VIDEO');
    render(<QueueJobCard job={makeJob({ input: 'C:/videos/clip.mp4' })} onRemove={() => {}} />);
    expect(getVideoPreviewMock).toHaveBeenCalledWith('C:/videos/clip.mp4');
    const img = await screen.findByTestId('queue-job-thumbnail');
    expect(img).toHaveAttribute('src', 'data:image/png;base64,VIDEO');
    expect(img).toHaveAttribute('alt', '');
  });

  it('renders an image thumbnail fetched from the image preview API', async () => {
    getImagePreviewMock.mockResolvedValue('data:image/png;base64,IMAGE');
    render(<QueueJobCard job={makeJob({ input: 'C:/pics/photo.png' })} onRemove={() => {}} />);
    expect(getImagePreviewMock).toHaveBeenCalledWith('C:/pics/photo.png');
    expect(await screen.findByTestId('queue-job-thumbnail')).toHaveAttribute('src', 'data:image/png;base64,IMAGE');
  });

  it('does not load a thumbnail for audio jobs', async () => {
    render(<QueueJobCard job={makeJob({ input: 'C:/music/track.mp3' })} onRemove={() => {}} />);
    expect(screen.queryByTestId('queue-job-thumbnail')).not.toBeInTheDocument();
    expect(getVideoPreviewMock).not.toHaveBeenCalled();
    expect(getImagePreviewMock).not.toHaveBeenCalled();
  });
});
