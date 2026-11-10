/**
 * @fileoverview Unit tests for the mux queue panel.
 *
 * The panel is the only place the mux queue can be driven from, so the tests
 * cover the control wiring (which IPC call each button issues, and when a
 * control is disabled) and the empty state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MuxQueuePanel from '../MuxQueuePanel';
import { useMuxQueueStore } from '../../stores/muxQueueStore';
import { QUEUE_STATUS } from '../../../shared/media-options';
import type { MuxQueueJob } from '../../../shared/types';

/**
 * Captures the `DndContext` handlers the panel registers, so a drag can be
 * committed without driving dnd-kit's pointer sensors (the same trick
 * `QueueDropArea.test.tsx` uses for the batch queue's drop overlay).
 */
const { dndHandlers } = vi.hoisted(() => ({
  dndHandlers: {
    onDragEnd: null as ((event: { active: { id: string }; over: { id: string } | null }) => void) | null,
  },
}));

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    DndContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd?: (event: never) => void }) => {
      dndHandlers.onDragEnd = onDragEnd as typeof dndHandlers.onDragEnd;
      return <>{children}</>;
    },
  };
});

const muxQueueStartMock = vi.mocked(window.electronAPI.muxQueueStart);
const muxQueuePauseMock = vi.mocked(window.electronAPI.muxQueuePause);
const muxQueueResumeMock = vi.mocked(window.electronAPI.muxQueueResume);
const muxQueueCancelAllMock = vi.mocked(window.electronAPI.muxQueueCancelAll);
const muxQueueClearCompletedMock = vi.mocked(window.electronAPI.muxQueueClearCompleted);
const muxQueueSetConcurrencyMock = vi.mocked(window.electronAPI.muxQueueSetConcurrency);
const muxQueueRemoveMock = vi.mocked(window.electronAPI.muxQueueRemove);
const muxQueueMoveToMock = vi.mocked(window.electronAPI.muxQueueMoveTo);

function makeJob(id: string, status: string = QUEUE_STATUS.QUEUED): MuxQueueJob {
  return {
    id,
    kind: 'remux',
    input: `C:/in/${id}.mp4`,
    output: `C:/out/${id}.mkv`,
    targets: [{ output: `C:/out/${id}.mkv`, options: {} }],
    transcoder: 'FFMPEG',
    status: status as MuxQueueJob['status'],
    progress: 0,
    createdAt: 1,
  };
}

function renderPanel() {
  return render(
    <MemoryRouter>
      <MuxQueuePanel />
    </MemoryRouter>,
  );
}

describe('MuxQueuePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMuxQueueStore.setState({ jobs: [], progress: {}, paused: false, concurrency: 1 });
  });

  it('shows an empty state with links to the remux and demux pages', () => {
    renderPanel();
    expect(screen.getByTestId('mux-queue-empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'muxQueue.openRemux' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'muxQueue.openDemux' })).toBeInTheDocument();
  });

  it('disables start, cancel all and clear completed when the queue is empty', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'muxQueue.start' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'muxQueue.cancelAll' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'muxQueue.clearCompleted' })).toBeDisabled();
  });

  it('starts the queue when a job is queued', () => {
    useMuxQueueStore.setState({ jobs: [makeJob('a')] });
    renderPanel();
    const start = screen.getByRole('button', { name: 'muxQueue.start' });
    expect(start).toBeEnabled();
    fireEvent.click(start);
    expect(muxQueueStartMock).toHaveBeenCalled();
  });

  it('pauses a running queue and resumes a paused one', () => {
    useMuxQueueStore.setState({ jobs: [makeJob('a', QUEUE_STATUS.RUNNING)] });
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'muxQueue.pause' }));
    expect(muxQueuePauseMock).toHaveBeenCalled();
  });

  it('resumes a paused queue', () => {
    useMuxQueueStore.setState({ jobs: [makeJob('a', QUEUE_STATUS.RUNNING)], paused: true });
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'muxQueue.resume' }));
    expect(muxQueueResumeMock).toHaveBeenCalled();
  });

  it('cancels every job and clears the completed ones', () => {
    useMuxQueueStore.setState({ jobs: [makeJob('a', QUEUE_STATUS.DONE)] });
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'muxQueue.cancelAll' }));
    expect(muxQueueCancelAllMock).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'muxQueue.clearCompleted' }));
    expect(muxQueueClearCompletedMock).toHaveBeenCalled();
  });

  it('changes the concurrency cap', async () => {
    renderPanel();
    const select = screen.getByLabelText('muxQueue.concurrency');
    fireEvent.mouseDown(select);
    fireEvent.click(await screen.findByRole('option', { name: '3' }));
    expect(muxQueueSetConcurrencyMock).toHaveBeenCalledWith(3);
  });

  it('removes a job', () => {
    useMuxQueueStore.setState({ jobs: [makeJob('a')] });
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.remove' }));
    expect(muxQueueRemoveMock).toHaveBeenCalledWith('a');
  });

  it('shows the queue statistics', async () => {
    useMuxQueueStore.setState({ jobs: [makeJob('a'), makeJob('b', QUEUE_STATUS.DONE)] });
    renderPanel();
    await waitFor(() => expect(screen.getByTestId('mux-queue-stats')).toBeInTheDocument());
    expect(screen.getByTestId('mux-queue-stats')).toHaveTextContent('muxQueue.stats');
  });

  it('reorders a queued job and tells the main process', () => {
    useMuxQueueStore.setState({ jobs: [makeJob('a'), makeJob('b')] });
    renderPanel();

    const handles = screen.getAllByRole('button', { name: 'muxQueue.dragHandle' });
    expect(handles).toHaveLength(2);

    // The drag itself is dnd-kit's business; the panel's contract is the
    // commit it issues and the local order it mirrors.
    act(() => {
      dndHandlers.onDragEnd?.({ active: { id: 'a' }, over: { id: 'b' } } as never);
    });

    expect(muxQueueMoveToMock).toHaveBeenCalledWith('a', 1);
    expect(useMuxQueueStore.getState().jobs.map((job) => job.id)).toEqual(['b', 'a']);
  });

  it('ignores a drop that lands on the dragged job itself', () => {
    useMuxQueueStore.setState({ jobs: [makeJob('a'), makeJob('b')] });
    renderPanel();

    act(() => {
      dndHandlers.onDragEnd?.({ active: { id: 'a' }, over: { id: 'a' } } as never);
    });

    expect(muxQueueMoveToMock).not.toHaveBeenCalled();
  });

  it('offers no drag handle for a running job', () => {
    useMuxQueueStore.setState({ jobs: [makeJob('a', QUEUE_STATUS.RUNNING)] });
    renderPanel();
    expect(screen.queryByRole('button', { name: 'muxQueue.dragHandle' })).not.toBeInTheDocument();
  });
});
