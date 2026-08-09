import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import CloseConfirmDialog from '../CloseConfirmDialog';
import { useConversionStore } from '../../stores/conversionStore';
import { useAudioExtractStore } from '../../stores/audioExtractStore';
import { useVideoCutStore, isVideoCutDirty } from '../../stores/videoCutStore';
import { useTaskStore } from '../../stores/taskStore';
import { useQueueStore } from '../../stores/queueStore';
import { QUEUE_STATUS } from '../../../shared/media-options';
import type { QueueJob } from '../../../shared/types';

const onCloseRequestedMock = vi.mocked(window.electronAPI.onWindowCloseRequested);
const windowCloseConfirmedMock = vi.mocked(window.electronAPI.windowCloseConfirmed);

function makeJob(status: QueueJob['status']): QueueJob {
  return {
    id: 'job-1',
    input: 'in.mp4',
    output: 'out.mp4',
    options: {},
    transcoder: 'FFMPEG',
    status,
    progress: 0,
    createdAt: 0,
  };
}

function triggerCloseRequested() {
  const handler = onCloseRequestedMock.mock.calls[0]?.[0];
  expect(handler).toBeDefined();
  act(() => handler?.());
}

describe('CloseConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onCloseRequestedMock.mockReturnValue(vi.fn());
    useConversionStore.setState({ isConverting: false, isDirty: false });
    useAudioExtractStore.setState({
      isConverting: false,
      isDirty: false,
      input: '',
      output: '',
      audioCodec: 'libmp3lame',
      audioBitrate: '192k',
    });
    useVideoCutStore.setState({
      isCutting: false,
      input: '',
      output: '',
      startTime: '00:00:00',
      endTime: '',
      duration: '',
      useDuration: false,
      includeAudio: true,
    });
    useTaskStore.setState({ isConverting: false, hasPendingWork: false });
    useQueueStore.setState({ jobs: [] });
  });

  it('subscribes to close requests on mount and unsubscribes on unmount', () => {
    const unsubscribe = vi.fn();
    onCloseRequestedMock.mockReturnValue(unsubscribe);
    const { unmount } = render(<CloseConfirmDialog />);
    expect(onCloseRequestedMock).toHaveBeenCalledTimes(1);
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('confirms the close immediately when no jobs are in progress', () => {
    render(<CloseConfirmDialog />);
    triggerCloseRequested();
    expect(windowCloseConfirmedMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Close EncodeX?')).not.toBeInTheDocument();
  });

  it('opens the dialog when the Convert page is converting', () => {
    useConversionStore.setState({ isConverting: true });
    render(<CloseConfirmDialog />);
    triggerCloseRequested();
    expect(windowCloseConfirmedMock).not.toHaveBeenCalled();
    expect(screen.getByText('Close EncodeX?')).toBeInTheDocument();
    expect(screen.getByText('There are jobs in progress or unsaved changes. Closing now will cancel them.')).toBeInTheDocument();
  });

  it('opens the dialog when the Convert page has unsaved form changes', () => {
    useConversionStore.setState({ isConverting: false, isDirty: true });
    render(<CloseConfirmDialog />);
    triggerCloseRequested();
    expect(windowCloseConfirmedMock).not.toHaveBeenCalled();
    expect(screen.getByText('Close EncodeX?')).toBeInTheDocument();
  });

  it('opens the dialog when a media task (image compress / video cut) is running', () => {
    useTaskStore.setState({ isConverting: true });
    render(<CloseConfirmDialog />);
    triggerCloseRequested();
    expect(windowCloseConfirmedMock).not.toHaveBeenCalled();
    expect(screen.getByText('Close EncodeX?')).toBeInTheDocument();
  });

  it('opens the dialog when the Image Compress page holds pending work', () => {
    useTaskStore.setState({ isConverting: false, hasPendingWork: true });
    render(<CloseConfirmDialog />);
    triggerCloseRequested();
    expect(windowCloseConfirmedMock).not.toHaveBeenCalled();
    expect(screen.getByText('Close EncodeX?')).toBeInTheDocument();
  });

  it('opens the dialog when the Audio Extract page is converting', () => {
    useAudioExtractStore.setState({ isConverting: true });
    render(<CloseConfirmDialog />);
    triggerCloseRequested();
    expect(windowCloseConfirmedMock).not.toHaveBeenCalled();
    expect(screen.getByText('Close EncodeX?')).toBeInTheDocument();
  });

  it('opens the dialog when the Audio Extract page has a configured/edited form', () => {
    useAudioExtractStore.setState({ isConverting: false, isDirty: true });
    render(<CloseConfirmDialog />);
    triggerCloseRequested();
    expect(windowCloseConfirmedMock).not.toHaveBeenCalled();
    expect(screen.getByText('Close EncodeX?')).toBeInTheDocument();
  });

  it('opens the dialog when the Video Cut page is cutting', () => {
    useVideoCutStore.setState({ isCutting: true });
    render(<CloseConfirmDialog />);
    triggerCloseRequested();
    expect(windowCloseConfirmedMock).not.toHaveBeenCalled();
    expect(screen.getByText('Close EncodeX?')).toBeInTheDocument();
  });

  it('opens the dialog when the Video Cut page holds a configured draft', () => {
    useVideoCutStore.setState({ isCutting: false, input: '/in/video.mp4', output: '/out/cut.mp4' });
    expect(isVideoCutDirty(useVideoCutStore.getState())).toBe(true);
    render(<CloseConfirmDialog />);
    triggerCloseRequested();
    expect(windowCloseConfirmedMock).not.toHaveBeenCalled();
    expect(screen.getByText('Close EncodeX?')).toBeInTheDocument();
  });

  it.each([[QUEUE_STATUS.QUEUED], [QUEUE_STATUS.RUNNING]])('opens the dialog when the batch queue has a %s job', (status) => {
    useQueueStore.setState({ jobs: [makeJob(status)] });
    render(<CloseConfirmDialog />);
    triggerCloseRequested();
    expect(windowCloseConfirmedMock).not.toHaveBeenCalled();
    expect(screen.getByText('Close EncodeX?')).toBeInTheDocument();
  });

  it('closes immediately when only completed queue jobs remain', () => {
    useQueueStore.setState({ jobs: [makeJob(QUEUE_STATUS.DONE)] });
    render(<CloseConfirmDialog />);
    triggerCloseRequested();
    expect(windowCloseConfirmedMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Close EncodeX?')).not.toBeInTheDocument();
  });

  it('confirms the close and dismisses the dialog when the user clicks confirm', async () => {
    useConversionStore.setState({ isConverting: true });
    render(<CloseConfirmDialog />);
    triggerCloseRequested();
    fireEvent.click(screen.getByText('Close Anyway'));
    expect(windowCloseConfirmedMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText('Close EncodeX?')).not.toBeInTheDocument());
  });

  it('keeps the window open when the user cancels', async () => {
    useConversionStore.setState({ isConverting: true });
    render(<CloseConfirmDialog />);
    triggerCloseRequested();
    fireEvent.click(screen.getByText('Cancel'));
    expect(windowCloseConfirmedMock).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Close EncodeX?')).not.toBeInTheDocument());
  });
});
