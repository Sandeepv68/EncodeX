import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBanner from '../ErrorBanner';
import { createError, ErrorCode } from '../../../shared/errors';

describe('ErrorBanner', () => {
  it('renders nothing when error is null', () => {
    const { container } = render(<ErrorBanner error={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders error message', () => {
    const error = createError(ErrorCode.FILE_NOT_FOUND, 'File not found');
    render(<ErrorBanner error={error} />);
    expect(screen.getByText('File not found')).toBeInTheDocument();
  });

  it('renders detail when provided', () => {
    const error = createError(ErrorCode.CONVERSION_FAILED, 'Failed', 'detail text');
    render(<ErrorBanner error={error} />);
    expect(screen.getByText('detail text')).toBeInTheDocument();
  });

  it('does not render detail when absent', () => {
    const error = createError(ErrorCode.UNKNOWN, 'Unknown');
    render(<ErrorBanner error={error} />);
    expect(screen.queryByText('detail')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    const error = createError(ErrorCode.FFMPEG_NOT_FOUND, 'ffmpeg missing');
    render(<ErrorBanner error={error} onClose={onClose} />);
    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not render close button when onClose is not provided', () => {
    const error = createError(ErrorCode.CANCELLED, 'Cancelled');
    render(<ErrorBanner error={error} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders error icon for error-level codes', () => {
    const error = createError(ErrorCode.PERMISSION_DENIED, 'Permission');
    const { container } = render(<ErrorBanner error={error} />);
    expect(container.querySelector('[data-testid="ErrorIcon"]')).not.toBeNull();
  });

  it('renders info icon for informational codes', () => {
    const error = createError(ErrorCode.INPUT_NOT_SPECIFIED, 'Input needed');
    const { container } = render(<ErrorBanner error={error} />);
    expect(container.querySelector('[data-testid="InfoOutlinedIcon"]')).not.toBeNull();
  });
});
