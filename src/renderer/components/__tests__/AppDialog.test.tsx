import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AppDialog from '../AppDialog';

describe('AppDialog', () => {
  it('uses onCloseButton for the header close action when provided', () => {
    const onClose = vi.fn();
    const onCloseButton = vi.fn();
    render(
      <AppDialog open onClose={onClose} onCloseButton={onCloseButton} title="Title" showCloseButton closeButtonTestId="dialog-close">
        Body
      </AppDialog>,
    );

    fireEvent.click(screen.getByTestId('dialog-close'));

    expect(onCloseButton).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('falls back to onClose for the header close action and uses default aria-label', () => {
    const onClose = vi.fn();
    render(
      <AppDialog open onClose={onClose} title="Title" showCloseButton closeButtonTestId="dialog-close">
        Body
      </AppDialog>,
    );

    const button = screen.getByTestId('dialog-close');
    expect(button).toHaveAttribute('aria-label', 'Close');
    fireEvent.click(button);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
