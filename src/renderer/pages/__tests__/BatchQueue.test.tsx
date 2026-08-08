import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import BatchQueue from '../BatchQueue';
import { useQueueStore } from '../../stores/queueStore';
import { useToastStore } from '../../stores/toastStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { QueueJob } from '../../../shared/types';

const queueListMock = vi.mocked(window.electronAPI.queueList);
const selectFilesMock = vi.mocked(window.electronAPI.selectFiles);
const selectDirectoryMock = vi.mocked(window.electronAPI.selectDirectory);
const queueAddMock = vi.mocked(window.electronAPI.queueAdd);
const queueRemoveMock = vi.mocked(window.electronAPI.queueRemove);
const queueCancelAllMock = vi.mocked(window.electronAPI.queueCancelAll);
const queueClearCompletedMock = vi.mocked(window.electronAPI.queueClearCompleted);
const queueSetConcurrencyMock = vi.mocked(window.electronAPI.queueSetConcurrency);
const queuePauseMock = vi.mocked(window.electronAPI.queuePause);
const queueResumeMock = vi.mocked(window.electronAPI.queueResume);
const queueExportMock = vi.mocked(window.electronAPI.queueExport);
const queueImportMock = vi.mocked(window.electronAPI.queueImport);
const onQueueProgressMock = vi.mocked(window.electronAPI.onQueueProgress);
const onQueueStatusChangeMock = vi.mocked(window.electronAPI.onQueueStatusChange);
const onQueueMovedMock = vi.mocked(window.electronAPI.onQueueMoved);

function job(overrides: Partial<QueueJob> = {}): QueueJob {
  return {
    id: 'job-1',
    input: '/in/video.mp4',
    output: '/out/video_converted.mp4',
    options: {},
    status: 'queued',
    progress: 0,
    createdAt: 1,
    transcoder: 'FFMPEG',
    ...overrides,
  };
}

function renderPage() {
  return render(<BatchQueue />);
}

describe('BatchQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useQueueStore.setState({ jobs: [] });
    useToastStore.setState({ toasts: [] });
    useSettingsStore.setState({ queueConcurrency: 1, hardwareAcceleration: true });
  });

  it('loads the queued jobs on mount', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1' }), job({ id: 'job-2', input: '/in/photo.png' })]);
    renderPage();
    expect(queueListMock).toHaveBeenCalledOnce();
    expect(await screen.findByText(/video\.mp4/)).toBeInTheDocument();
    expect(screen.getByText(/photo\.png/)).toBeInTheDocument();
  });

  it('pushes the persisted concurrency cap to the main process on mount', () => {
    queueListMock.mockResolvedValue([]);
    renderPage();
    expect(queueSetConcurrencyMock).toHaveBeenCalledWith(1);
  });

  it('shows the empty message when there are no jobs', () => {
    queueListMock.mockResolvedValue([]);
    renderPage();
    expect(screen.getByText('batchQueue.empty')).toBeInTheDocument();
  });

  it('shows a hardware acceleration alert when acceleration is enabled', () => {
    useSettingsStore.setState({ hardwareAcceleration: true });
    queueListMock.mockResolvedValue([]);
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('convert.hardwareAccelAlert');
  });

  it('does not show the hardware acceleration alert when acceleration is disabled', () => {
    useSettingsStore.setState({ hardwareAcceleration: false });
    queueListMock.mockResolvedValue([]);
    renderPage();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('adds files with a transcode operation and the default suffix', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/video.mp4']);
    queueAddMock.mockResolvedValue('job-3');
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() =>
      expect(queueAddMock).toHaveBeenCalledWith(
        '/in/video.mp4',
        '/in/video_converted.mp4',
        {
          videoCodec: 'libx264',
          audioCodec: 'aac',
          videoBitrate: undefined,
          audioBitrate: undefined,
          scale: undefined,
          pixelFormat: 'yuv420p',
          hardwareAcceleration: true,
          hwaccelMode: 'auto',
        },
        'FFMPEG',
        false,
      ),
    );
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success' && t.message === 'toast.jobAdded')).toBe(true);
  });

  it('adds multiple files and maps each output path', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/a/one.mkv', '/a/two.mkv']);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() => expect(queueAddMock).toHaveBeenCalledTimes(2));
    expect(queueAddMock).toHaveBeenCalledWith('/a/one.mkv', '/a/one_converted.mkv', expect.any(Object), 'FFMPEG', false);
    expect(queueAddMock).toHaveBeenCalledWith('/a/two.mkv', '/a/two_converted.mkv', expect.any(Object), 'FFMPEG', false);
  });

  it('adds files with the extract audio operation dropping the video codec', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/video.mp4']);
    renderPage();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('batchQueue.operationExtractAudio'));
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() =>
      expect(queueAddMock).toHaveBeenCalledWith(
        '/in/video.mp4',
        '/in/video_converted.mp4',
        {
          videoCodec: undefined,
          audioCodec: 'aac',
          videoBitrate: undefined,
          audioBitrate: undefined,
          scale: undefined,
          pixelFormat: undefined,
          hardwareAcceleration: true,
          hwaccelMode: 'auto',
        },
        'FFMPEG',
        false,
      ),
    );
  });

  it('adds files with the compress image operation dropping the audio codec', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/photo.png']);
    renderPage();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('batchQueue.operationCompressImage'));
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() =>
      expect(queueAddMock).toHaveBeenCalledWith(
        '/in/photo.png',
        '/in/photo_converted.png',
        {
          videoCodec: 'libx264',
          audioCodec: undefined,
          videoBitrate: undefined,
          audioBitrate: undefined,
          scale: undefined,
          pixelFormat: undefined,
          hardwareAcceleration: true,
          hwaccelMode: 'auto',
        },
        'FFMPEG',
        false,
      ),
    );
  });

  it('uses the chosen container as the output extension for transcode jobs', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/video.mp4']);
    queueAddMock.mockResolvedValue('job-3');
    renderPage();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[5]);
    fireEvent.click(screen.getByText('mkv'));
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() =>
      expect(queueAddMock).toHaveBeenCalledWith('/in/video.mp4', '/in/video_converted.mkv', expect.any(Object), 'FFMPEG', false),
    );
  });

  it('clears a container that is incompatible with the selected video codec', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/video.mkv']);
    queueAddMock.mockResolvedValue('job-3');
    renderPage();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[5]);
    fireEvent.click(screen.getByText('mp4'));
    fireEvent.mouseDown(screen.getAllByRole('combobox')[3]);
    fireEvent.click(screen.getByText('Theora (libtheora)'));
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() =>
      expect(queueAddMock).toHaveBeenCalledWith('/in/video.mkv', '/in/video_converted.mkv', expect.any(Object), 'FFMPEG', false),
    );
  });

  it('does nothing when no files are selected', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue([]);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    await waitFor(() => expect(selectFilesMock).toHaveBeenCalledOnce());
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it('removes a job when its remove button is clicked', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-9' })]);
    queueRemoveMock.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.remove' }));
    expect(queueRemoveMock).toHaveBeenCalledWith('job-9');
  });

  it('cancels all jobs and clears the list', async () => {
    queueListMock.mockResolvedValue([job()]);
    queueCancelAllMock.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.cancelAll' }));
    await waitFor(() => expect(queueCancelAllMock).toHaveBeenCalledOnce());
    expect(useQueueStore.getState().jobs).toHaveLength(0);
    expect(useToastStore.getState().toasts.some((t) => t.type === 'info' && t.message === 'toast.allCancelled')).toBe(true);
  });

  it('clears done and errored jobs but keeps queued jobs', async () => {
    queueListMock.mockResolvedValue([
      job({ id: 'job-done', status: 'done' }),
      job({ id: 'job-error', status: 'error', error: 'boom' }),
      job({ id: 'job-queued', status: 'queued' }),
    ]);
    queueClearCompletedMock.mockResolvedValue(2);
    renderPage();
    await screen.findAllByText(/video\.mp4/);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.clearCompleted' }));
    await waitFor(() => expect(queueClearCompletedMock).toHaveBeenCalledOnce());
    expect(useQueueStore.getState().jobs.map((j) => j.id)).toEqual(['job-queued']);
  });

  it('subscribes to live queue progress and renders time/speed/eta captions', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1', status: 'running', progress: 40 })]);
    renderPage();
    await screen.findByText(/video\.mp4/);
    const onProgress = onQueueProgressMock.mock.calls[0][0];
    act(() => {
      onProgress({
        job: job({ id: 'job-1', status: 'running', progress: 55 }),
        progress: { percent: 55, time: '00:00:08', fps: 30, speed: '3.0x', eta: '4', bitrate: '1500k' },
      });
    });
    expect(useQueueStore.getState().jobs[0].progress).toBe(55);
    expect(useQueueStore.getState().progress['job-1'].speed).toBe('3.0x');
    expect(screen.getByText('Speed: 3.0x')).toBeInTheDocument();
    expect(screen.getByText('ETA: 4s')).toBeInTheDocument();
  });

  it('retries a failed job with its original options', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1', status: 'error', error: 'boom' })]);
    queueAddMock.mockResolvedValue('job-2');
    queueRemoveMock.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.retry' }));
    await waitFor(() => expect(queueAddMock).toHaveBeenCalledWith('/in/video.mp4', '/out/video_converted.mp4', {}, 'FFMPEG', true));
    expect(queueRemoveMock).toHaveBeenCalledWith('job-1');
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success' && t.message === 'toast.jobAdded')).toBe(true);
  });

  it('renders status counts on the filter chips when jobs exist', async () => {
    queueListMock.mockResolvedValue([
      job({ id: 'job-1', status: 'queued' }),
      job({ id: 'job-2', status: 'running' }),
      job({ id: 'job-3', status: 'done' }),
      job({ id: 'job-4', status: 'error', error: 'boom' }),
    ]);
    renderPage();
    await screen.findAllByText(/video\.mp4/);
    expect(screen.getByText('All (4)')).toBeInTheDocument();
    expect(screen.getByText('Queued (1)')).toBeInTheDocument();
    expect(screen.getByText('Running (1)')).toBeInTheDocument();
    expect(screen.getByText('Done (1)')).toBeInTheDocument();
    expect(screen.getByText('Failed (1)')).toBeInTheDocument();
  });

  it('shows a best-effort ETA on the right side of the filter row while jobs are running', async () => {
    queueListMock.mockResolvedValue([
      job({ id: 'job-1', status: 'running' }),
      job({ id: 'job-2', status: 'queued' }),
      job({ id: 'job-3', status: 'queued' }),
    ]);
    useQueueStore.setState({
      progress: {
        'job-1': { percent: 50, time: '00:00:05', fps: 30, speed: '2x', eta: '45', bitrate: '1500k' },
      },
    });
    renderPage();
    await screen.findAllByText(/video\.mp4/);
    expect(screen.getByText(/ETA ~2m 15s/)).toBeInTheDocument();
  });

  it('shows a batch-finished toast when the running count drops to zero', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1', status: 'running' })]);
    renderPage();
    await screen.findByText(/video\.mp4/);
    const onStatusChange = onQueueStatusChangeMock.mock.calls[0][0];
    act(() => {
      onStatusChange(job({ id: 'job-1', status: 'running' }));
    });
    act(() => {
      onStatusChange(job({ id: 'job-1', status: 'done' }));
    });
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success' && t.message === 'Batch finished: 1 succeeded, 0 failed')).toBe(
      true,
    );
  });

  it('filters jobs by status chip', async () => {
    queueListMock.mockResolvedValue([
      job({ id: 'job-1', status: 'queued' }),
      job({ id: 'job-2', status: 'running' }),
      job({ id: 'job-3', status: 'done' }),
    ]);
    renderPage();
    await screen.findAllByText(/video\.mp4/);
    expect(screen.getAllByText(/video\.mp4/)).toHaveLength(3);
    fireEvent.click(screen.getByText('Done (1)'));
    expect(screen.getAllByText(/video\.mp4/)).toHaveLength(1);
    fireEvent.click(screen.getByText('All (3)'));
    expect(screen.getAllByText(/video\.mp4/)).toHaveLength(3);
  });

  it('filters jobs by search term on the input basename', async () => {
    queueListMock.mockResolvedValue([
      job({ id: 'job-1' }),
      job({ id: 'job-2', input: '/in/photo.png', output: '/out/photo_converted.png' }),
    ]);
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.change(screen.getByPlaceholderText('Search files...'), { target: { value: 'photo' } });
    expect(screen.queryByText(/video\.mp4/)).not.toBeInTheDocument();
    expect(screen.getByText(/photo\.png/)).toBeInTheDocument();
  });

  it('enqueues files dropped onto the window', async () => {
    queueListMock.mockResolvedValue([]);
    const getPathMock = vi.mocked(window.electronAPI.getPathForFile);
    getPathMock.mockReturnValue('/in/dropped.mp4');
    queueAddMock.mockResolvedValue('job-9');
    renderPage();
    await waitFor(() => expect(queueListMock).toHaveBeenCalledOnce());
    const file = new File(['x'], 'dropped.mp4');
    fireEvent.drop(window, { dataTransfer: { files: [file] } });
    await waitFor(() =>
      expect(queueAddMock).toHaveBeenCalledWith('/in/dropped.mp4', '/in/dropped_converted.mp4', expect.any(Object), 'FFMPEG', false),
    );
  });

  it('does nothing when a drop carries no files', async () => {
    queueListMock.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(queueListMock).toHaveBeenCalledOnce());
    fireEvent.drop(window, { dataTransfer: { files: [] } });
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it('skips duplicate files already in the queue', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1' })]);
    selectFilesMock.mockResolvedValue(['/in/video.mp4']);
    queueAddMock.mockResolvedValue('job-9');
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() => expect(queueAddMock).not.toHaveBeenCalled());
    expect(
      useToastStore.getState().toasts.some((toast) => toast.type === 'warning' && toast.message === 'batchQueue.skippedDuplicates'),
    ).toBe(true);
  });

  it('skips files that do not fit the compress-image operation', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/video.mp4']);
    queueAddMock.mockResolvedValue('job-9');
    renderPage();
    await waitFor(() => expect(queueListMock).toHaveBeenCalledOnce());
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('batchQueue.operationCompressImage'));
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() => expect(queueAddMock).not.toHaveBeenCalled());
    expect(
      useToastStore.getState().toasts.some((toast) => toast.type === 'warning' && toast.message === 'batchQueue.skippedDuplicates'),
    ).toBe(true);
  });

  it('enqueues image files with the compress-image operation', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/photo.png']);
    queueAddMock.mockResolvedValue('job-9');
    renderPage();
    await waitFor(() => expect(queueListMock).toHaveBeenCalledOnce());
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('batchQueue.operationCompressImage'));
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() =>
      expect(queueAddMock).toHaveBeenCalledWith('/in/photo.png', '/in/photo_converted.png', expect.any(Object), 'FFMPEG', false),
    );
  });

  it('mirrors main-process job moves by swapping adjacent queued jobs', async () => {
    queueListMock.mockResolvedValue([
      job({ id: 'job-1', status: 'running' }),
      job({ id: 'job-2', status: 'queued' }),
      job({ id: 'job-3', status: 'queued' }),
    ]);
    renderPage();
    await screen.findAllByText(/video\.mp4/);
    const onMoved = onQueueMovedMock.mock.calls[0][0];
    act(() => {
      onMoved({ id: 'job-3', direction: -1 });
    });
    expect(useQueueStore.getState().jobs.map((j) => j.id)).toEqual(['job-1', 'job-3', 'job-2']);
  });

  it('ignores onQueueMoved events for unknown jobs', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-2', status: 'queued' }), job({ id: 'job-3', status: 'queued' })]);
    renderPage();
    await screen.findAllByText(/video\.mp4/);
    const onMoved = onQueueMovedMock.mock.calls[0][0];
    act(() => {
      onMoved({ id: 'missing', direction: -1 });
    });
    expect(useQueueStore.getState().jobs.map((j) => j.id)).toEqual(['job-2', 'job-3']);
  });

  it('pauses the queue via queuePause and switches the toolbar to Resume', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1', status: 'running' })]);
    queuePauseMock.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.pause' }));
    await waitFor(() => expect(queuePauseMock).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'batchQueue.resume' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'batchQueue.pause' })).not.toBeInTheDocument();
  });

  it('resumes the queue via queueResume and switches the toolbar back to Pause', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1', status: 'running' })]);
    queuePauseMock.mockResolvedValue(undefined);
    queueResumeMock.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.pause' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'batchQueue.resume' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.resume' }));
    await waitFor(() => expect(queueResumeMock).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'batchQueue.pause' })).toBeInTheDocument();
  });

  it('disables the pause button when no jobs are queued or running', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1', status: 'done' })]);
    renderPage();
    await screen.findByText(/video\.mp4/);
    expect(screen.getByRole('button', { name: 'batchQueue.pause' })).toBeDisabled();
  });

  it('writes outputs into the chosen directory when a directory is browsed', async () => {
    queueListMock.mockResolvedValue([]);
    selectDirectoryMock.mockResolvedValue('/out');
    selectFilesMock.mockResolvedValue(['/in/video.mp4']);
    queueAddMock.mockResolvedValue('job-9');
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.browse' }));
    await waitFor(() => expect(selectDirectoryMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() =>
      expect(queueAddMock).toHaveBeenCalledWith('/in/video.mp4', '/out/video_converted.mp4', expect.any(Object), 'FFMPEG', false),
    );
  });

  it('keeps source-adjacent output paths when no directory is browsed', async () => {
    queueListMock.mockResolvedValue([]);
    selectDirectoryMock.mockResolvedValue(null);
    selectFilesMock.mockResolvedValue(['/in/video.mp4']);
    queueAddMock.mockResolvedValue('job-9');
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.browse' }));
    await waitFor(() => expect(selectDirectoryMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() =>
      expect(queueAddMock).toHaveBeenCalledWith('/in/video.mp4', '/in/video_converted.mp4', expect.any(Object), 'FFMPEG', false),
    );
  });

  it('passes overwrite true when the overwrite checkbox is enabled', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/video.mp4']);
    queueAddMock.mockResolvedValue('job-9');
    renderPage();
    fireEvent.click(screen.getByLabelText('batchQueue.overwrite'));
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() =>
      expect(queueAddMock).toHaveBeenCalledWith('/in/video.mp4', '/in/video_converted.mp4', expect.any(Object), 'FFMPEG', true),
    );
  });

  it('shows an error toast when enqueuing an existing output without overwrite', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/video.mp4']);
    queueAddMock.mockRejectedValue(new Error('The output file already exists. Enable overwrite to replace it.'));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() => expect(useToastStore.getState().toasts.some((toast) => toast.type === 'error')).toBe(true));
  });

  it('shows the review dialog with a row per selected file and the toolbar operation pre-filled', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/one.mp4', '/in/two.mkv']);
    queueAddMock.mockResolvedValue('job-9');
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    expect(await screen.findByText('batchQueue.reviewTitle')).toBeInTheDocument();
    expect(screen.getByText(/one\.mp4/)).toBeInTheDocument();
    expect(screen.getByText(/two\.mkv/)).toBeInTheDocument();
    expect(screen.getByText('batchQueue.reviewAdd')).toBeInTheDocument();
    fireEvent.click(screen.getByText('batchQueue.reviewAdd'));
    await waitFor(() => expect(queueAddMock).toHaveBeenCalledTimes(2));
  });

  it('enqueues a per-file operation chosen in the review dialog', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/video.mp4', '/in/photo.png']);
    queueAddMock.mockResolvedValue('job-9');
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    await screen.findByText('batchQueue.reviewTitle');
    const photoRow = screen.getByText(/photo\.png/).closest('.MuiStack-root') as HTMLElement;
    fireEvent.mouseDown(within(photoRow).getByRole('combobox'));
    fireEvent.click(screen.getByText('batchQueue.operationCompressImage'));
    fireEvent.click(screen.getByText('batchQueue.reviewAdd'));
    await waitFor(() =>
      expect(queueAddMock).toHaveBeenCalledWith('/in/video.mp4', '/in/video_converted.mp4', expect.any(Object), 'FFMPEG', false),
    );
    expect(queueAddMock).toHaveBeenCalledWith('/in/photo.png', '/in/photo_converted.png', expect.any(Object), 'FFMPEG', false);
  });

  it('cancelling the review dialog enqueues nothing and closes it', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/video.mp4']);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    await screen.findByText('batchQueue.reviewTitle');
    fireEvent.click(screen.getByText('batchQueue.reviewCancel'));
    expect(queueAddMock).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('batchQueue.reviewTitle')).not.toBeInTheDocument());
  });

  it('exports the queue via queueExport and shows a success toast', async () => {
    queueListMock.mockResolvedValue([]);
    queueExportMock.mockResolvedValue(2);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.exportQueue' }));
    await waitFor(() => expect(queueExportMock).toHaveBeenCalledOnce());
    expect(useToastStore.getState().toasts.some((toast) => toast.type === 'success' && toast.message === 'batchQueue.exported')).toBe(true);
  });

  it('does not toast when the export dialog is cancelled', async () => {
    queueListMock.mockResolvedValue([]);
    queueExportMock.mockResolvedValue(0);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.exportQueue' }));
    await waitFor(() => expect(queueExportMock).toHaveBeenCalledOnce());
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('imports a queue via queueImport and shows a success toast', async () => {
    queueListMock.mockResolvedValue([]);
    queueImportMock.mockResolvedValue(3);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.importQueue' }));
    await waitFor(() => expect(queueImportMock).toHaveBeenCalledOnce());
    expect(useToastStore.getState().toasts.some((toast) => toast.type === 'success' && toast.message === 'batchQueue.imported')).toBe(true);
  });

  it('does not toast when the import dialog is cancelled', async () => {
    queueListMock.mockResolvedValue([]);
    queueImportMock.mockResolvedValue(0);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.importQueue' }));
    await waitFor(() => expect(queueImportMock).toHaveBeenCalledOnce());
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('shows an error toast when importing an invalid queue file', async () => {
    queueListMock.mockResolvedValue([]);
    queueImportMock.mockRejectedValue(new Error('The queue file could not be read. It may be corrupted or in an unsupported format.'));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.importQueue' }));
    await waitFor(() => expect(useToastStore.getState().toasts.some((toast) => toast.type === 'error')).toBe(true));
  });
});
