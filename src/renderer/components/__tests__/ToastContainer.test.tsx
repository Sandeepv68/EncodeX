import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ToastContainer from '../ToastContainer';
import { useToastStore } from '../../stores/toastStore';
import { useErrorStore } from '../../stores/errorStore';
import { createError, ErrorCode } from '../../../shared/errors';

describe('ToastContainer', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
    useErrorStore.setState({ currentError: null, errorHistory: [] });
  });

  it('renders nothing when there are no toasts', () => {
    const { container } = render(<ToastContainer />);
    expect(container.innerHTML).toBe('');
  });

  it('renders the first toast message', () => {
    useToastStore.setState({ toasts: [{ id: 't1', type: 'success', message: 'Saved!' }] });
    render(<ToastContainer />);
    expect(screen.getByText('Saved!')).toBeInTheDocument();
  });

  it('renders the toast detail when present', () => {
    useToastStore.setState({ toasts: [{ id: 't1', type: 'warning', message: 'Careful', detail: 'something' }] });
    render(<ToastContainer />);
    expect(screen.getByText('something')).toBeInTheDocument();
  });

  it('removes the toast from the store when closed', () => {
    useToastStore.setState({ toasts: [{ id: 't1', type: 'info', message: 'Heads up' }] });
    render(<ToastContainer />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('renders the action button when action is provided', () => {
    const onClick = vi.fn();
    useToastStore.setState({
      toasts: [{ id: 't1', type: 'info', message: 'Update available', action: { label: 'Update Now', onClick } }],
    });
    render(<ToastContainer />);
    const button = screen.getByRole('button', { name: 'Update Now' });
    expect(button).toBeInTheDocument();
  });

  it('calls action onClick and closes the toast when action button is clicked', () => {
    const onClick = vi.fn();
    useToastStore.setState({
      toasts: [{ id: 't1', type: 'info', message: 'Update available', action: { label: 'Update Now', onClick } }],
    });
    render(<ToastContainer />);
    fireEvent.click(screen.getByRole('button', { name: 'Update Now' }));
    expect(onClick).toHaveBeenCalled();
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('does not render an action button when action is not provided', () => {
    useToastStore.setState({ toasts: [{ id: 't1', type: 'success', message: 'Done' }] });
    render(<ToastContainer />);
    expect(screen.queryByRole('button', { name: 'Update Now' })).not.toBeInTheDocument();
  });

  it('renders error-store failures in the unified viewport with detail', () => {
    useErrorStore.getState().showError(createError(ErrorCode.FILE_NOT_FOUND, 'File gone', 'detail text'));
    render(<ToastContainer />);
    expect(screen.getByTestId('toast-error')).toBeInTheDocument();
    expect(screen.getByText('toast.error.FILE_NOT_FOUND')).toBeInTheDocument();
    expect(screen.getByText('detail text')).toBeInTheDocument();
  });

  it('maps error-store codes to the expected variant', () => {
    useErrorStore.getState().showErrorMessage(ErrorCode.PROBE_FAILED, 'probe detail');
    render(<ToastContainer />);
    expect(screen.getByTestId('toast-warning')).toBeInTheDocument();
    expect(screen.getByText('toast.error.PROBE_FAILED')).toBeInTheDocument();
  });
});
