/**
 * @fileoverview Unit tests for the shared mux queue status indicator.
 *
 * The indicator is the only place the Remux and Demux pages show queue state,
 * so it has to report the queue's counters and offer a way to reach the queue.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MuxQueueStatusIndicator from '../MuxQueueStatusIndicator';
import { useMuxQueueStore } from '../../stores/muxQueueStore';
import { QUEUE_STATUS } from '../../../shared/media-options';
import type { MuxQueueJob } from '../../../shared/types';

function makeJob(id: string, status: string): MuxQueueJob {
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

describe('MuxQueueStatusIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMuxQueueStore.setState({ jobs: [], progress: {}, paused: false, concurrency: 1 });
  });

  it('reports an empty queue', () => {
    render(<MuxQueueStatusIndicator />);
    expect(screen.getByTestId('mux-queue-status')).toHaveTextContent('muxQueue.empty');
  });

  it('reports queued and running jobs', () => {
    useMuxQueueStore.setState({ jobs: [makeJob('a', QUEUE_STATUS.QUEUED), makeJob('b', QUEUE_STATUS.RUNNING)] });
    render(<MuxQueueStatusIndicator />);
    expect(screen.getByTestId('mux-queue-status')).toHaveTextContent('muxQueue.stats');
  });

  it('reports finished jobs', () => {
    useMuxQueueStore.setState({ jobs: [makeJob('a', QUEUE_STATUS.DONE)] });
    render(<MuxQueueStatusIndicator />);
    expect(screen.getByTestId('mux-queue-status')).toHaveTextContent('muxQueue.stats');
  });

  it('offers a link to the mux queue tab', () => {
    render(<MuxQueueStatusIndicator />);
    expect(screen.getByRole('button', { name: 'muxQueue.viewQueue' })).toBeInTheDocument();
  });

  it('navigates to the mux queue tab when the link is used', () => {
    render(<MuxQueueStatusIndicator />);
    fireEvent.click(screen.getByRole('button', { name: 'muxQueue.viewQueue' }));
    expect(window.location.hash).toBe('#/batch?tab=mux');
  });
});
