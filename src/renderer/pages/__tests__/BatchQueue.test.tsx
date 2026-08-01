import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BatchQueue from '../BatchQueue';
import { useQueueStore } from '../../stores/queueStore';
import { useToastStore } from '../../stores/toastStore';
import type { QueueJob } from '../../../shared/types';

const queueListMock = vi.mocked(window.electronAPI.queueList);
const selectFilesMock = vi.mocked(window.electronAPI.selectFiles);
const queueAddMock = vi.mocked(window.electronAPI.queueAdd);
const queueRemoveMock = vi.mocked(window.electronAPI.queueRemove);
const queueCancelAllMock = vi.mocked(window.electronAPI.queueCancelAll);

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
  });

  it('loads the queued jobs on mount', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-1' }), job({ id: 'job-2', input: '/in/photo.png' })]);
    renderPage();
    expect(queueListMock).toHaveBeenCalledOnce();
    expect(await screen.findByText(/video\.mp4/)).toBeInTheDocument();
    expect(screen.getByText(/photo\.png/)).toBeInTheDocument();
  });

  it('shows the empty message when there are no jobs', () => {
    queueListMock.mockResolvedValue([]);
    renderPage();
    expect(screen.getByText('batchQueue.empty')).toBeInTheDocument();
  });

  it('adds files with a transcode operation and the default suffix', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/video.mp4']);
    queueAddMock.mockResolvedValue('job-3');
    renderPage();
    fireEvent.click(screen.getByText('batchQueue.addFiles'));
    await waitFor(() =>
      expect(queueAddMock).toHaveBeenCalledWith(
        '/in/video.mp4',
        '/in/video_converted.mp4',
        { videoCodec: 'libx264', audioCodec: 'aac', hardwareAcceleration: true, hwaccelMode: 'auto' },
        'FFMPEG',
      ),
    );
    expect(useToastStore.getState().toasts.some((t) => t.type === 'success' && t.message === 'toast.jobAdded')).toBe(true);
  });

  it('adds multiple files and maps each output path', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/a/one.mkv', '/a/two.mkv']);
    renderPage();
    fireEvent.click(screen.getByText('batchQueue.addFiles'));
    await waitFor(() => expect(queueAddMock).toHaveBeenCalledTimes(2));
    expect(queueAddMock).toHaveBeenCalledWith('/a/one.mkv', '/a/one_converted.mkv', expect.any(Object), 'FFMPEG');
    expect(queueAddMock).toHaveBeenCalledWith('/a/two.mkv', '/a/two_converted.mkv', expect.any(Object), 'FFMPEG');
  });

  it('adds files with the extract audio operation dropping the video codec', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/video.mp4']);
    renderPage();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('batchQueue.operationExtractAudio'));
    fireEvent.click(screen.getByText('batchQueue.addFiles'));
    await waitFor(() =>
      expect(queueAddMock).toHaveBeenCalledWith(
        '/in/video.mp4',
        '/in/video_converted.mp4',
        { videoCodec: undefined, audioCodec: 'aac', hardwareAcceleration: true, hwaccelMode: 'auto' },
        'FFMPEG',
      ),
    );
  });

  it('adds files with the compress image operation dropping the audio codec', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue(['/in/photo.png']);
    renderPage();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('batchQueue.operationCompressImage'));
    fireEvent.click(screen.getByText('batchQueue.addFiles'));
    await waitFor(() =>
      expect(queueAddMock).toHaveBeenCalledWith(
        '/in/photo.png',
        '/in/photo_converted.png',
        { videoCodec: 'libx264', audioCodec: undefined, hardwareAcceleration: true, hwaccelMode: 'auto' },
        'FFMPEG',
      ),
    );
  });

  it('does nothing when no files are selected', async () => {
    queueListMock.mockResolvedValue([]);
    selectFilesMock.mockResolvedValue([]);
    renderPage();
    fireEvent.click(screen.getByText('batchQueue.addFiles'));
    await waitFor(() => expect(selectFilesMock).toHaveBeenCalledOnce());
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it('removes a job when its remove button is clicked', async () => {
    queueListMock.mockResolvedValue([job({ id: 'job-9' })]);
    queueRemoveMock.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.click(screen.getByText('batchQueue.remove'));
    expect(queueRemoveMock).toHaveBeenCalledWith('job-9');
  });

  it('cancels all jobs and clears the list', async () => {
    queueListMock.mockResolvedValue([job()]);
    queueCancelAllMock.mockResolvedValue(undefined);
    renderPage();
    await screen.findByText(/video\.mp4/);
    fireEvent.click(screen.getByText('batchQueue.cancelAll'));
    await waitFor(() => expect(queueCancelAllMock).toHaveBeenCalledOnce());
    expect(useQueueStore.getState().jobs).toHaveLength(0);
    expect(useToastStore.getState().toasts.some((t) => t.type === 'info' && t.message === 'toast.allCancelled')).toBe(true);
  });
});
