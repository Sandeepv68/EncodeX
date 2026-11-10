/**
 * @fileoverview Unit tests for the mux queue job card.
 *
 * The card has to make two very different job kinds readable: a remux with a
 * single output, and a demux with one output per extracted stream.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import MuxQueueJobCard from '../MuxQueueJobCard';
import { QUEUE_STATUS } from '../../../shared/media-options';
import type { MuxQueueJob } from '../../../shared/types';

function makeJob(overrides: Partial<MuxQueueJob> = {}): MuxQueueJob {
  return {
    id: 'mux-1',
    kind: 'remux',
    input: 'C:/in/movie.mp4',
    output: 'C:/out/movie.mkv',
    targets: [{ output: 'C:/out/movie.mkv', options: {} }],
    transcoder: 'FFMPEG',
    status: QUEUE_STATUS.QUEUED,
    progress: 0,
    createdAt: 1,
    ...overrides,
  };
}

function renderCard(job: MuxQueueJob, onRemove = vi.fn()) {
  return render(
    <DndContext>
      <MuxQueueJobCard job={job} onRemove={onRemove} />
    </DndContext>,
  );
}

describe('MuxQueueJobCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the kind chip, the input filename, and the status', () => {
    renderCard(makeJob());
    expect(screen.getByTestId('mux-queue-job-kind')).toHaveTextContent('muxQueue.kindRemux');
    expect(screen.getByText('movie.mp4')).toBeInTheDocument();
    expect(screen.getByText(QUEUE_STATUS.QUEUED)).toBeInTheDocument();
  });

  it('shows a demux job as a demux with its target count and output folder', () => {
    renderCard(
      makeJob({
        kind: 'demux',
        output: 'C:/out/streams',
        targets: [
          { output: 'C:/out/streams/movie.video.mkv', options: {}, label: 'video:0' },
          { output: 'C:/out/streams/movie.audio_0.m4a', options: {}, label: 'audio:1' },
        ],
      }),
    );
    expect(screen.getByTestId('mux-queue-job-kind')).toHaveTextContent('muxQueue.kindDemux');
    expect(screen.getByTestId('mux-queue-job-summary')).toHaveTextContent('muxQueue.targets');
    expect(screen.getByTestId('mux-queue-job-summary')).toHaveTextContent('C:/out/streams');
  });

  it('expands to list every target', () => {
    renderCard(
      makeJob({
        kind: 'demux',
        targets: [
          { output: 'C:/out/a.mkv', options: {}, label: 'video:0' },
          { output: 'C:/out/b.m4a', options: {}, label: 'audio:1' },
        ],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.expandDetails' }));
    expect(screen.getByText('C:/out/a.mkv')).toBeInTheDocument();
    expect(screen.getByText('C:/out/b.m4a')).toBeInTheDocument();
  });

  it('shows the error of a failed job', () => {
    renderCard(makeJob({ status: QUEUE_STATUS.ERROR, error: 'ffmpeg exited with 1' }));
    expect(screen.getByTestId('mux-queue-job-error')).toHaveTextContent('ffmpeg exited with 1');
  });

  it('removes the job', () => {
    const onRemove = vi.fn();
    renderCard(makeJob(), onRemove);
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.remove' }));
    expect(onRemove).toHaveBeenCalledWith('mux-1');
  });

  it('offers a drag handle only for queued jobs', () => {
    const { unmount } = renderCard(makeJob());
    expect(screen.getByRole('button', { name: 'muxQueue.dragHandle' })).toBeInTheDocument();
    unmount();
    renderCard(makeJob({ status: QUEUE_STATUS.RUNNING }));
    expect(screen.queryByRole('button', { name: 'muxQueue.dragHandle' })).not.toBeInTheDocument();
  });
});
