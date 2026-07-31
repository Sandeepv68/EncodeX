import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorSnackbar from '../ErrorSnackbar';
import { createError, ErrorCode } from '../../../shared/errors';

describe('ErrorSnackbar', () => {
  it('renders nothing when error is null', () => {
    const { container } = render(<ErrorSnackbar error={null} onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the error message', () => {
    const error = createError(ErrorCode.FILE_NOT_FOUND, 'File gone');
    render(<ErrorSnackbar error={error} onClose={() => {}} />);
    expect(screen.getByText('File gone')).toBeInTheDocument();
  });

  it('renders detail when present', () => {
    const error = createError(ErrorCode.CONVERSION_FAILED, 'Failed', 'detail text');
    render(<ErrorSnackbar error={error} onClose={() => {}} />);
    expect(screen.getByText('detail text')).toBeInTheDocument();
  });

  it('omits detail when absent', () => {
    const error = createError(ErrorCode.UNKNOWN, 'Unknown');
    render(<ErrorSnackbar error={error} onClose={() => {}} />);
    expect(screen.queryByText('detail')).not.toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    const error = createError(ErrorCode.CANCELLED, 'Cancelled');
    render(<ErrorSnackbar error={error} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
