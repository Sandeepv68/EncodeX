import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ToastContainer from '../ToastContainer';
import { useToastStore } from '../../stores/toastStore';

describe('ToastContainer', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
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
    fireEvent.click(screen.getByRole('button'));
    expect(useToastStore.getState().toasts).toEqual([]);
  });
});
