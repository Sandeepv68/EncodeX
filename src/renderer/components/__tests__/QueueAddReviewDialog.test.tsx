import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QueueAddReviewDialog from '../QueueAddReviewDialog';
import type { QueueAddReviewSelection } from '../types';

function props(overrides: Partial<Parameters<typeof QueueAddReviewDialog>[0]> = {}) {
  return {
    open: true,
    files: ['/in/one.mp4', '/in/two.mkv'],
    defaultOperation: 'transcode',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

describe('QueueAddReviewDialog', () => {
  it('renders a row per file pre-filled with the default operation', () => {
    render(<QueueAddReviewDialog {...props()} />);
    expect(screen.getByText('batchQueue.reviewTitle')).toBeInTheDocument();
    expect(screen.getByText(/one\.mp4/)).toBeInTheDocument();
    expect(screen.getByText(/two\.mkv/)).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.getAllByText('batchQueue.operationTranscode')).toHaveLength(2);
  });

  it('is hidden when open is false', () => {
    render(<QueueAddReviewDialog {...props({ open: false })} />);
    expect(screen.queryByText('batchQueue.reviewTitle')).not.toBeInTheDocument();
  });

  it('confirms with one selection per file using the default operation', () => {
    const onConfirm = vi.fn();
    render(<QueueAddReviewDialog {...props({ onConfirm })} />);
    fireEvent.click(screen.getByText('batchQueue.reviewAdd'));
    expect(onConfirm).toHaveBeenCalledWith([
      { file: '/in/one.mp4', operation: 'transcode' },
      { file: '/in/two.mkv', operation: 'transcode' },
    ] as QueueAddReviewSelection[]);
  });

  it('confirms with a per-file operation override', () => {
    const onConfirm = vi.fn();
    render(<QueueAddReviewDialog {...props({ onConfirm })} />);
    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
    fireEvent.click(screen.getByText('batchQueue.operationExtractAudio'));
    fireEvent.click(screen.getByText('batchQueue.reviewAdd'));
    expect(onConfirm).toHaveBeenCalledWith([
      { file: '/in/one.mp4', operation: 'transcode' },
      { file: '/in/two.mkv', operation: 'extract_audio' },
    ] as QueueAddReviewSelection[]);
  });

  it('fires onCancel when the cancel button is clicked', () => {
    const onCancel = vi.fn();
    render(<QueueAddReviewDialog {...props({ onCancel })} />);
    fireEvent.click(screen.getByText('batchQueue.reviewCancel'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
