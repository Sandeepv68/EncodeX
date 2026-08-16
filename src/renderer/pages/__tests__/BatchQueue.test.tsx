import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import BatchQueue from '../BatchQueue';
import { useQueueStore } from '../../stores/queueStore';
import { useToastStore } from '../../stores/toastStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useDismissedAlertsStore } from '../../stores/dismissedAlertsStore';
import type { QueueJob } from '../../../shared/types';
import { FILE_FILTERS } from '../../../shared/file-extensions';
import { BATCH_CONFIG_STORAGE_KEY } from '../../../shared/constants';

const queueListMock = vi.mocked(window.electronAPI.queueList);
const queueGetStateMock = vi.mocked(window.electronAPI.queueGetState);
const selectFilesMock = vi.mocked(window.electronAPI.selectFiles);
const selectDirectoryMock = vi.mocked(window.electronAPI.selectDirectory);
const queueAddMock = vi.mocked(window.electronAPI.queueAdd);
const queueRemoveMock = vi.mocked(window.electronAPI.queueRemove);
const queueCancelAllMock = vi.mocked(window.electronAPI.queueCancelAll);
const queueClearCompletedMock = vi.mocked(window.electronAPI.queueClearCompleted);
const queueSetConcurrencyMock = vi.mocked(window.electronAPI.queueSetConcurrency);
const queuePauseMock = vi.mocked(window.electronAPI.queuePause);
const queueResumeMock = vi.mocked(window.electronAPI.queueResume);
const queueStartMock = vi.mocked(window.electronAPI.queueStart);
const queueExportMock = vi.mocked(window.electronAPI.queueExport);
const queueImportMock = vi.mocked(window.electronAPI.queueImport);
const queueUpdateOptionsMock = vi.mocked(window.electronAPI.queueUpdateOptions);
const onQueueProgressMock = vi.mocked(window.electronAPI.onQueueProgress);
const onQueueStatusChangeMock = vi.mocked(window.electronAPI.onQueueStatusChange);
const onQueueMovedMock = vi.mocked(window.electronAPI.onQueueMoved);

function job(overrides: Partial<QueueJob> = {}): QueueJob {
  return {
    id: 'job-1',
    input: '/in/video.mp4',
    output: '/out/video_encodex_converted.mp4',
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
    localStorage.clear();
    useQueueStore.setState({ jobs: [] });
    useToastStore.setState({ toasts: [] });
    useSettingsStore.setState({ queueConcurrency: 1, hardwareAcceleration: true });
    useDismissedAlertsStore.setState({ dismissed: [] });
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

  it('dismisses the hardware acceleration alert via its close button', () => {
    useSettingsStore.setState({ hardwareAcceleration: true });
    queueListMock.mockResolvedValue([]);
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('convert.hardwareAccelAlert');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
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
        '/in/video_encodex_converted.mp4',
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
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success' && t.message === 'batchQueue.enqueued')).toBe(true);
  });

  it('adds multiple files and maps each output path', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/a/one.mkv', '/a/two.mkv']);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() => expect(queueAddMock).toHaveBeenCalledTimes(2));
    expect(queueAddMock).toHaveBeenCalledWith('/a/one.mkv', '/a/one_encodex_converted.mkv', expect.any(Object), 'FFMPEG', false);
    expect(queueAddMock).toHaveBeenCalledWith('/a/two.mkv', '/a/two_encodex_converted.mkv', expect.any(Object), 'FFMPEG', false);
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
        '/in/video_encodex_converted.m4a',
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
        '/in/photo_encodex_converted.png',
        {
          videoCodec: undefined,
          audioCodec: undefined,
          videoBitrate: undefined,
          audioBitrate: undefined,
          qscale: undefined,
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

  it('compresses images with the chosen format and quality', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/photo.png']);
    queueAddMock.mockResolvedValue('job-3');
    renderPage();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('batchQueue.operationCompressImage'));
    fireEvent.mouseDown(screen.getAllByRole('combobox')[3]);
    fireEvent.click(screen.getByText('WebP'));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() =>
      expect(queueAddMock).toHaveBeenCalledWith(
        '/in/photo.png',
        '/in/photo_encodex_converted.webp',
        {
          videoCodec: undefined,
          audioCodec: undefined,
          videoBitrate: undefined,
          audioBitrate: undefined,
          qscale: 15,
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
      expect(queueAddMock).toHaveBeenCalledWith('/in/video.mp4', '/in/video_encodex_converted.mkv', expect.any(Object), 'FFMPEG', false),
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
      expect(queueAddMock).toHaveBeenCalledWith('/in/video.mkv', '/in/video_encodex_converted.mkv', expect.any(Object), 'FFMPEG', false),
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

  it('cancels all jobs after confirmation and clears the list', async () => {
    queueListMock.mockResolvedValue([job()]);
    queueCancelAllMock.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.cancelAll' }));
    fireEvent.click(await screen.findByRole('button', { name: 'batchQueue.confirmCancelAll' }));
    await waitFor(() => expect(queueCancelAllMock).toHaveBeenCalledOnce());
    expect(useQueueStore.getState().jobs).toHaveLength(0);
    expect(useToastStore.getState().toasts.some((t) => t.type === 'info' && t.message === 'toast.allCancelled')).toBe(true);
  });

  it('does not cancel anything when the cancel-all dialog is dismissed', async () => {
    queueListMock.mockResolvedValue([job()]);
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.cancelAll' }));
    fireEvent.click(await screen.findByRole('button', { name: 'batchQueue.dialogCancel' }));
    expect(queueCancelAllMock).not.toHaveBeenCalled();
    expect(useQueueStore.getState().jobs).toHaveLength(1);
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
    await waitFor(() => expect(queueAddMock).toHaveBeenCalledWith('/in/video.mp4', '/out/video_encodex_converted.mp4', {}, 'FFMPEG', true));
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

  it('labels the search field and filter chips for screen readers', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1' }), job({ id: 'job-2', status: 'error', error: 'boom' })]);
    renderPage();
    await screen.findAllByText(/video\.mp4/);
    expect(screen.getByRole('textbox', { name: 'Search files...' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All (2)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Failed (1)' })).toHaveAttribute('aria-pressed', 'false');
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

  it('raises a native OS notification when the batch finishes', async () => {
    const notificationCtor = vi.fn();
    class FakeNotification {
      static permission = 'granted';
      static requestPermission = vi.fn();
      constructor(title: string, options?: { body?: string }) {
        notificationCtor(title, options);
      }
    }
    vi.stubGlobal('Notification', FakeNotification);
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
    expect(notificationCtor).toHaveBeenCalledWith('batchQueue.notificationTitle', {
      body: 'Batch finished: 1 succeeded, 0 failed',
    });
    vi.unstubAllGlobals();
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
      job({ id: 'job-2', input: '/in/photo.png', output: '/out/photo_encodex_converted.png' }),
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
      expect(queueAddMock).toHaveBeenCalledWith(
        '/in/dropped.mp4',
        '/in/dropped_encodex_converted.mp4',
        expect.any(Object),
        'FFMPEG',
        false,
      ),
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
    queueListMock.mockResolvedValue([job({ id: 'job-1', output: '/in/video_encodex_converted.mp4' })]);
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
      expect(queueAddMock).toHaveBeenCalledWith('/in/photo.png', '/in/photo_encodex_converted.png', expect.any(Object), 'FFMPEG', false),
    );
  });

  it('mirrors main-process job moves by repositioning the queued job', async () => {
    queueListMock.mockResolvedValue([
      job({ id: 'job-1', status: 'running' }),
      job({ id: 'job-2', status: 'queued' }),
      job({ id: 'job-3', status: 'queued' }),
    ]);
    renderPage();
    await screen.findAllByText(/video\.mp4/);
    const onMoved = onQueueMovedMock.mock.calls[0][0];
    act(() => {
      onMoved({ id: 'job-3', toPosition: 0 });
    });
    expect(useQueueStore.getState().jobs.map((j) => j.id)).toEqual(['job-1', 'job-3', 'job-2']);
  });

  it('ignores onQueueMoved events for unknown jobs', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-2', status: 'queued' }), job({ id: 'job-3', status: 'queued' })]);
    renderPage();
    await screen.findAllByText(/video\.mp4/);
    const onMoved = onQueueMovedMock.mock.calls[0][0];
    act(() => {
      onMoved({ id: 'missing', toPosition: 0 });
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

  it('disables the start button when no jobs are queued or running', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1', status: 'done' })]);
    renderPage();
    await screen.findByText(/video\.mp4/);
    expect(screen.getByRole('button', { name: 'batchQueue.start' })).toBeDisabled();
  });

  it('starts the queue via queueStart when queued jobs are waiting', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1', status: 'queued' })]);
    queueStartMock.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText(/video\.mp4/);
    const start = screen.getByRole('button', { name: 'batchQueue.start' });
    expect(start).toBeEnabled();
    fireEvent.click(start);
    await waitFor(() => expect(queueStartMock).toHaveBeenCalledOnce());
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
      expect(queueAddMock).toHaveBeenCalledWith('/in/video.mp4', '/out/video_encodex_converted.mp4', expect.any(Object), 'FFMPEG', false),
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
      expect(queueAddMock).toHaveBeenCalledWith('/in/video.mp4', '/in/video_encodex_converted.mp4', expect.any(Object), 'FFMPEG', false),
    );
  });

  it('restores a persisted output folder and overwrite toggle on mount', async () => {
    localStorage.setItem(BATCH_CONFIG_STORAGE_KEY, JSON.stringify({ outputDir: '/restored', overwrite: true }));
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/video.mp4']);
    queueAddMock.mockResolvedValue('job-9');
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() =>
      expect(queueAddMock).toHaveBeenCalledWith(
        '/in/video.mp4',
        '/restored/video_encodex_converted.mp4',
        expect.any(Object),
        'FFMPEG',
        true,
      ),
    );
  });

  it('persists the chosen output folder and overwrite toggle', async () => {
    queueListMock.mockResolvedValue([]);
    selectDirectoryMock.mockResolvedValue('/out');
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.browse' }));
    await waitFor(() => expect(selectDirectoryMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByLabelText('batchQueue.overwrite'));
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(BATCH_CONFIG_STORAGE_KEY) ?? '{}');
      expect(stored.outputDir).toBe('/out');
      expect(stored.overwrite).toBe(true);
    });
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
      expect(queueAddMock).toHaveBeenCalledWith('/in/video.mp4', '/in/video_encodex_converted.mp4', expect.any(Object), 'FFMPEG', true),
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
      expect(queueAddMock).toHaveBeenCalledWith('/in/video.mp4', '/in/video_encodex_converted.mp4', expect.any(Object), 'FFMPEG', false),
    );
    expect(queueAddMock).toHaveBeenCalledWith('/in/photo.png', '/in/photo_encodex_converted.png', expect.any(Object), 'FFMPEG', false);
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

  it('skips non-media files with a warning toast', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/video.mp4', '/in/notes.txt']);
    queueAddMock.mockResolvedValue('job-9');
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() => expect(queueAddMock).toHaveBeenCalledTimes(1));
    expect(
      useToastStore.getState().toasts.some((toast) => toast.type === 'warning' && toast.message === 'batchQueue.skippedDuplicates'),
    ).toBe(true);
  });

  it('allows re-adding the same input when the computed output differs from an existing job', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1', output: '/out/video_encodex_converted.mp4' })]);
    selectFilesMock.mockResolvedValue(['/in/video.mp4']);
    queueAddMock.mockResolvedValue('job-2');
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() =>
      expect(queueAddMock).toHaveBeenCalledWith('/in/video.mp4', '/in/video_encodex_converted.mp4', expect.any(Object), 'FFMPEG', false),
    );
  });

  it('skips selections whose output path would overwrite an already-claimed output', async () => {
    queueListMock.mockResolvedValue([]);
    selectDirectoryMock.mockResolvedValue('/out');
    selectFilesMock.mockResolvedValue(['/a/video.mp4', '/b/video.mp4']);
    queueAddMock.mockResolvedValue('job-9');
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.browse' }));
    await waitFor(() => expect(selectDirectoryMock).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() => expect(queueAddMock).toHaveBeenCalledTimes(1));
    expect(queueAddMock).toHaveBeenCalledWith('/a/video.mp4', '/out/video_encodex_converted.mp4', expect.any(Object), 'FFMPEG', false);
    expect(
      useToastStore.getState().toasts.some((toast) => toast.type === 'warning' && toast.message === 'batchQueue.skippedDuplicates'),
    ).toBe(true);
  });

  it('shows a single success toast and per-file error toasts when some enqueues fail', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/one.mp4', '/in/two.mp4', '/in/three.mp4']);
    queueAddMock.mockResolvedValueOnce('job-1').mockResolvedValueOnce('job-2').mockRejectedValueOnce(new Error('boom'));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() => expect(queueAddMock).toHaveBeenCalledTimes(3));
    const toasts = useToastStore.getState().toasts;
    expect(toasts.some((t) => t.type === 'success' && t.message === 'batchQueue.enqueued')).toBe(true);
    expect(toasts.some((t) => t.type === 'error')).toBe(true);
  });

  it('shows an error toast when retrying a failed job fails', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1', status: 'error', error: 'boom' })]);
    queueAddMock.mockRejectedValue(new Error('retry failed'));
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.retry' }));
    await waitFor(() =>
      expect(useToastStore.getState().toasts.some((toast) => toast.type === 'error' && toast.message === 'retry failed')).toBe(true),
    );
  });

  it('shows a no-results message when the active filter matches nothing', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1', status: 'done' })]);
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.click(screen.getByText('Failed (0)'));
    expect(screen.getByText('batchQueue.noResults')).toBeInTheDocument();
  });

  it('skips dotfiles that carry no supported extension', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/.env']);
    queueAddMock.mockResolvedValue('job-9');
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    fireEvent.click(await screen.findByText('batchQueue.reviewAdd'));
    await waitFor(() => expect(queueAddMock).not.toHaveBeenCalled());
    expect(useToastStore.getState().toasts.some((toast) => toast.type === 'warning')).toBe(true);
  });

  it('reflects an already-paused queue reported by the main process on mount', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1', status: 'running' })]);
    queueGetStateMock.mockResolvedValue({ paused: true, concurrency: 1 });
    renderPage();
    await screen.findByText(/video\.mp4/);
    expect(await screen.findByRole('button', { name: 'batchQueue.resume' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'batchQueue.pause' })).not.toBeInTheDocument();
  });

  it('restricts the file picker to supported media files', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue([]);
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.addFiles' }));
    await waitFor(() => expect(selectFilesMock).toHaveBeenCalledWith([FILE_FILTERS.MEDIA_FILES]));
  });

  it('restores the last-used encoding configuration from storage on mount', async () => {
    localStorage.setItem(
      BATCH_CONFIG_STORAGE_KEY,
      JSON.stringify({
        operation: 'compress_image',
        videoCodec: 'libx264',
        audioCodec: 'aac',
        container: 'webp',
        videoBitrate: '2000k',
        audioBitrate: '192k',
        quality: '15',
        scale: '1280x720',
        pixelFormat: 'yuv420p',
      }),
    );
    queueListMock.mockResolvedValue([]);
    renderPage();
    expect(screen.getByText('batchQueue.operationCompressImage')).toBeInTheDocument();
    expect(screen.getByText('WebP')).toBeInTheDocument();
  });

  it('shows the options-editable alert when queued jobs exist and none are running', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1', options: { videoCodec: 'libx264', audioCodec: 'aac' } })]);
    renderPage();
    await screen.findByText(/video\.mp4/);
    expect(screen.getByText('batchQueue.optionsEditableAlert')).toBeInTheDocument();
    expect(screen.queryByText('batchQueue.optionsLockedAlert')).not.toBeInTheDocument();
  });

  it('shows the options-locked alert once a job is running', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1', status: 'running' }), job({ id: 'job-2', status: 'queued' })]);
    renderPage();
    await screen.findAllByText(/video\.mp4/);
    expect(screen.getByText('batchQueue.optionsLockedAlert')).toBeInTheDocument();
    expect(screen.queryByText('batchQueue.optionsEditableAlert')).not.toBeInTheDocument();
  });

  it('propagates a container change to every queued job', async () => {
    queueListMock.mockResolvedValue([
      job({ id: 'job-1', options: { videoCodec: 'libx264', audioCodec: 'aac' } }),
      job({
        id: 'job-2',
        input: '/in/two.mp4',
        output: '/out/two_encodex_converted.mp4',
        options: { videoCodec: 'libx264', audioCodec: 'aac' },
      }),
    ]);
    queueUpdateOptionsMock.mockResolvedValue(true);
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'batchQueue.container' }));
    fireEvent.click(screen.getByText('mkv'));
    await waitFor(() => expect(queueUpdateOptionsMock).toHaveBeenCalledTimes(2));
    expect(queueUpdateOptionsMock).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ videoCodec: 'libx264', audioCodec: 'aac', pixelFormat: 'yuv420p' }),
      '/out/video_encodex_converted.mkv',
    );
    expect(queueUpdateOptionsMock).toHaveBeenCalledWith(
      'job-2',
      expect.objectContaining({ videoCodec: 'libx264', audioCodec: 'aac' }),
      '/out/two_encodex_converted.mkv',
    );
  });

  it('does not propagate panel changes once the batch is running', async () => {
    queueListMock.mockResolvedValue([
      job({ id: 'job-1', status: 'running', options: { videoCodec: 'libx264', audioCodec: 'aac' } }),
      job({ id: 'job-2', status: 'queued', options: { videoCodec: 'libx264', audioCodec: 'aac' } }),
    ]);
    queueUpdateOptionsMock.mockResolvedValue(true);
    renderPage();
    await screen.findAllByText(/video\.mp4/);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'batchQueue.container' }));
    fireEvent.click(screen.getByText('mkv'));
    expect(queueUpdateOptionsMock).not.toHaveBeenCalled();
  });

  it('skips a queued job whose recomputed output would collide with another job', async () => {
    queueListMock.mockResolvedValue([
      job({ id: 'job-1', options: { videoCodec: 'libx264', audioCodec: 'aac' } }),
      job({
        id: 'job-2',
        input: '/in/two.mp4',
        output: '/out/video_encodex_converted.mkv',
        options: { videoCodec: 'libx264', audioCodec: 'aac' },
      }),
    ]);
    queueUpdateOptionsMock.mockResolvedValue(true);
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'batchQueue.container' }));
    fireEvent.click(screen.getByText('mkv'));
    await waitFor(() =>
      expect(
        useToastStore.getState().toasts.some((toast) => toast.type === 'warning' && toast.message === 'batchQueue.outputCollisionSkipped'),
      ).toBe(true),
    );
    expect(queueUpdateOptionsMock).toHaveBeenCalledTimes(1);
    expect(queueUpdateOptionsMock).toHaveBeenCalledWith('job-2', expect.any(Object), '/out/video_encodex_converted.mkv');
    expect(queueUpdateOptionsMock).not.toHaveBeenCalledWith('job-1', expect.any(Object), '/out/video_encodex_converted.mkv');
  });

  it('opens the per-job dialog and saves the edited options', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1', options: { videoCodec: 'libx264', audioCodec: 'aac' } })]);
    queueUpdateOptionsMock.mockResolvedValue(true);
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.editOptions' }));
    expect(await screen.findByText('Edit options for video.mp4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(queueUpdateOptionsMock).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({ videoCodec: 'libx264', audioCodec: 'aac' }),
        '/out/video_encodex_converted.mp4',
      ),
    );
    expect(useToastStore.getState().toasts.some((toast) => toast.type === 'success' && toast.message === 'batchQueue.optionsUpdated')).toBe(
      true,
    );
  });

  it('rejects a per-job edit whose output would collide with another job', async () => {
    queueListMock.mockResolvedValue([
      job({ id: 'job-1', options: { videoCodec: 'libx264', audioCodec: 'aac' } }),
      job({
        id: 'job-2',
        input: '/in/two.mp4',
        output: '/out/video_encodex_converted.mp4',
        options: { videoCodec: 'libx264', audioCodec: 'aac' },
      }),
    ]);
    queueUpdateOptionsMock.mockResolvedValue(true);
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.click(screen.getAllByRole('button', { name: 'batchQueue.editOptions' })[0]);
    expect(await screen.findByText('Edit options for video.mp4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(
        useToastStore.getState().toasts.some((toast) => toast.type === 'warning' && toast.message === 'batchQueue.outputCollision'),
      ).toBe(true),
    );
    expect(queueUpdateOptionsMock).not.toHaveBeenCalled();
    expect(screen.getByText('Edit options for video.mp4')).toBeInTheDocument();
  });

  it('does not propagate to jobs customized through the per-job dialog', async () => {
    queueListMock.mockResolvedValue([
      job({ id: 'job-1', options: { videoCodec: 'libx264', audioCodec: 'aac' } }),
      job({
        id: 'job-2',
        input: '/in/two.mp4',
        output: '/out/two_encodex_converted.mp4',
        options: { videoCodec: 'libx264', audioCodec: 'aac' },
      }),
    ]);
    queueUpdateOptionsMock.mockResolvedValue(true);
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.click(screen.getAllByRole('button', { name: 'batchQueue.editOptions' })[0]);
    expect(await screen.findByText('Edit options for video.mp4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(queueUpdateOptionsMock).toHaveBeenCalled());
    queueUpdateOptionsMock.mockClear();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'batchQueue.container' }));
    fireEvent.click(screen.getByText('mkv'));
    await waitFor(() =>
      expect(queueUpdateOptionsMock).toHaveBeenCalledWith(
        'job-2',
        expect.objectContaining({ videoCodec: 'libx264', audioCodec: 'aac' }),
        '/out/two_encodex_converted.mkv',
      ),
    );
    expect(queueUpdateOptionsMock).not.toHaveBeenCalledWith('job-1', expect.any(Object), '/out/video_encodex_converted.mkv');
  });

  it('disables the per-job edit action once the batch is running', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1', status: 'running' }), job({ id: 'job-2', status: 'queued' })]);
    renderPage();
    await screen.findAllByText(/video\.mp4/);
    expect(screen.getAllByRole('button', { name: 'batchQueue.editOptions' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'batchQueue.editOptions' })).toBeDisabled();
  });

  it('renders a title-level toggle that condenses the page to the queue', () => {
    queueListMock.mockResolvedValue([]);
    renderPage();
    const toggle = screen.getByTestId('batch-queue-condense');
    const controls = document.getElementById('batch-controls-section');
    const encoding = document.getElementById('encoding-options-section');
    expect(controls).not.toBeNull();
    expect(encoding).not.toBeNull();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(controls).toHaveAttribute('aria-hidden', 'false');
    expect(encoding).toHaveAttribute('aria-hidden', 'false');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(controls).toHaveAttribute('aria-hidden', 'true');
    expect(encoding).toHaveAttribute('aria-hidden', 'true');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(controls).toHaveAttribute('aria-hidden', 'false');
    expect(encoding).toHaveAttribute('aria-hidden', 'false');
  });

  it('swaps the toggle label and persists the condensed preference', () => {
    queueListMock.mockResolvedValue([]);
    renderPage();
    const toggle = screen.getByTestId('batch-queue-condense');
    expect(toggle).toHaveAttribute('aria-label', 'batchQueue.condense');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-label', 'batchQueue.expand');
    expect(localStorage.getItem('encodex-batch-condensed')).toBe('1');
  });

  it('opens the add-files review dialog with Ctrl+O', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/video.mp4']);
    renderPage();
    fireEvent.keyDown(window, { code: 'KeyO', key: 'o', ctrlKey: true });
    expect(await screen.findByText('batchQueue.reviewTitle')).toBeInTheDocument();
  });

  it('focuses the search field with F', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1' })]);
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.keyDown(window, { code: 'KeyF', key: 'f' });
    expect(screen.getByRole('textbox', { name: 'Search files...' })).toHaveFocus();
  });

  it('condenses the page with C', async () => {
    queueListMock.mockResolvedValue([]);
    renderPage();
    const toggle = screen.getByTestId('batch-queue-condense');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(window, { code: 'KeyC', key: 'c' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('switches to the running filter with 3', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1', status: 'running' })]);
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.keyDown(window, { code: 'Digit3', key: '3' });
    expect(screen.getByRole('button', { name: 'Running (1)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All (1)' })).toHaveAttribute('aria-pressed', 'false');
  });
});
