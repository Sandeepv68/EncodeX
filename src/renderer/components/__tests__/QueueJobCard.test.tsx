import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QueueJobCard from '../QueueJobCard';
import { QUEUE_STATUS } from '../../../shared/media-options';
import type { QueueJob } from '../../../shared/types';

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
  it('renders the file basename and output path', () => {
    render(<QueueJobCard job={makeJob()} onRemove={() => {}} />);
    expect(screen.getByText('clip.mp4')).toBeInTheDocument();
    expect(screen.getByText('C:/videos/clip_out.mp4')).toBeInTheDocument();
  });

  it('renders the status chip', () => {
    render(<QueueJobCard job={makeJob({ status: QUEUE_STATUS.DONE })} onRemove={() => {}} />);
    expect(screen.getByText(QUEUE_STATUS.DONE)).toBeInTheDocument();
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

  it('does not render progress for non-running jobs', () => {
    render(<QueueJobCard job={makeJob({ status: QUEUE_STATUS.QUEUED, progress: 50 })} onRemove={() => {}} />);
    expect(screen.queryByText('50.0%')).not.toBeInTheDocument();
  });

  it('renders the error text when present', () => {
    render(<QueueJobCard job={makeJob({ error: 'something broke' })} onRemove={() => {}} />);
    expect(screen.getByText('something broke')).toBeInTheDocument();
  });

  it('falls back to the full path when no directory separator is present', () => {
    render(<QueueJobCard job={makeJob({ input: 'clip.mp4' })} onRemove={() => {}} />);
    expect(screen.getByText('clip.mp4')).toBeInTheDocument();
  });
});
