/**
 * @fileoverview Unit tests for the mux queue job card.
 *
 * The card has to make two very different job kinds readable: a remux with a
 * single output, and a demux with one output per extracted stream.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    expect(screen.getByTestId('mux-queue-job-summary')).toHaveTextContent('streams');
  });

  it('summarizes a remux job with its output file name', () => {
    renderCard(makeJob());
    expect(screen.getByTestId('mux-queue-job-summary')).toHaveTextContent('movie.mkv');
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

  it('lists the input path, the output path and the transcoder in the details', () => {
    renderCard(makeJob());
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.expandDetails' }));
    expect(screen.getByTestId('mux-queue-job-input')).toHaveTextContent('C:/in/movie.mp4');
    expect(screen.getByTestId('mux-queue-job-output')).toHaveTextContent('C:/out/movie.mkv');
    expect(screen.getByText('FFMPEG')).toBeInTheDocument();
  });

  it('shows the output path only once for a remux job', () => {
    renderCard(makeJob({ targets: [{ output: 'C:/out/movie.mkv', options: {}, label: 'C:/out/movie.mkv' }] }));
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.expandDetails' }));
    expect(screen.getAllByText('C:/out/movie.mkv')).toHaveLength(1);
  });

  it('shows the conversion options of a target', () => {
    renderCard(
      makeJob({
        kind: 'demux',
        output: 'C:/out/streams',
        targets: [
          {
            output: 'C:/out/streams/movie.video.mkv',
            options: { copy: false, videoCodec: 'libx264', videoBitrate: '2000k' },
            label: 'video:0',
          },
        ],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.expandDetails' }));
    expect(screen.getByText(/batchQueue.optionVideoCodec/)).toHaveTextContent('libx264');
    expect(screen.getByText(/batchQueue.optionVideoBitrate/)).toHaveTextContent('2000k');
  });

  it('shows the remaining conversion options of a target', () => {
    renderCard(
      makeJob({
        kind: 'demux',
        output: 'C:/out/streams',
        targets: [
          {
            output: 'C:/out/streams/movie.video.mkv',
            options: {
              copy: true,
              audioCodec: 'aac',
              audioBitrate: '192k',
              qscale: 20,
              scale: '1280x720',
              pixelFormat: 'yuv420p',
              startTime: '00:01:00',
              endTime: '00:02:00',
              hardwareAcceleration: false,
              hwaccelMode: 'auto',
              videoFilters: ['fps=30'],
            },
            label: 'video:0',
          },
        ],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.expandDetails' }));
    expect(screen.getByText(/batchQueue.optionCopy/)).toHaveTextContent('batchQueue.yes');
    expect(screen.getByText(/batchQueue.optionAudioCodec/)).toHaveTextContent('aac');
    expect(screen.getByText(/batchQueue.optionAudioBitrate/)).toHaveTextContent('192k');
    expect(screen.getByText(/batchQueue.optionQscale/)).toHaveTextContent('20');
    expect(screen.getByText(/batchQueue.optionScale/)).toHaveTextContent('1280x720');
    expect(screen.getByText(/batchQueue.optionPixelFormat/)).toHaveTextContent('yuv420p');
    expect(screen.getByText(/batchQueue.optionTrim/)).toHaveTextContent('00:01:00');
    expect(screen.getByText(/batchQueue.optionHwaccel/)).toHaveTextContent('batchQueue.no');
    expect(screen.getByText(/batchQueue.optionHwaccelMode/)).toHaveTextContent('auto');
    expect(screen.getByText(/remux.filtersTitle/)).toHaveTextContent('1');
  });

  it('shows the job level options of a remux job', () => {
    renderCard(
      makeJob({
        kind: 'remux',
        output: 'C:/out/movie.mkv',
        targets: [{ output: 'C:/out/movie.mkv', options: { copy: true, videoCodec: 'libx264' }, label: 'C:/out/movie.mkv' }],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.expandDetails' }));
    expect(screen.getByText('batchQueue.detailsOptions')).toBeInTheDocument();
    expect(screen.getByText('batchQueue.optionCopy')).toBeInTheDocument();
    expect(screen.getByText('batchQueue.yes')).toBeInTheDocument();
    expect(screen.getByText('batchQueue.optionVideoCodec')).toBeInTheDocument();
    expect(screen.getByText('libx264')).toBeInTheDocument();
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

  it('reveals the first output in the file manager', async () => {
    renderCard(makeJob());
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.revealInFolder' }));
    await waitFor(() => expect(window.electronAPI.revealFile).toHaveBeenCalledWith('C:/out/movie.mkv'));
  });

  it('copies the first output path to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderCard(makeJob());
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.copyPath' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('C:/out/movie.mkv'));
  });

  it('retries a failed job', () => {
    const onRetry = vi.fn();
    render(
      <DndContext>
        <MuxQueueJobCard job={makeJob({ status: QUEUE_STATUS.ERROR })} onRemove={() => undefined} onRetry={onRetry} />
      </DndContext>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
