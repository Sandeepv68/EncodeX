import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDialog from '../ConfirmDialog';

function makeProps(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  return {
    open: true,
    title: 'Delete?',
    message: 'This cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
}

describe('ConfirmDialog', () => {
  it('renders title, message and action labels', () => {
    render(<ConfirmDialog {...makeProps()} />);
    expect(screen.getByText('Delete?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', () => {
    const props = makeProps();
    render(<ConfirmDialog {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  it('calls onConfirm when confirm is clicked', () => {
    const props = makeProps();
    render(<ConfirmDialog {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(props.onConfirm).toHaveBeenCalledOnce();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('does not render content when closed', () => {
    render(<ConfirmDialog {...makeProps({ open: false })} />);
    expect(screen.queryByText('Delete?')).not.toBeInTheDocument();
  });
});
