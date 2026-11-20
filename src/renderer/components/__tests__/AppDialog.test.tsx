import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { createAppTheme } from '../../../shared/theme/theme';
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

  it('pushes the close button to the trailing edge of the header', () => {
    render(
      <AppDialog open title="Title" showCloseButton closeButtonTestId="dialog-close">
        Body
      </AppDialog>,
    );

    const button = screen.getByTestId('dialog-close');
    const header = button.parentElement as HTMLElement;
    const title = header.firstElementChild as HTMLElement;

    expect(header).toHaveStyle({ display: 'flex', alignItems: 'center' });
    expect(title).toHaveStyle({ display: 'flex', flexGrow: '1', minWidth: '0px' });
    expect(button).toHaveStyle({ flexShrink: '0' });
  });

  it('uses a lighter divider color for the header and footer rules', () => {
    render(
      <ThemeProvider theme={createAppTheme('light', 'ltr')}>
        <AppDialog open title="Title" actions={<span>Actions</span>}>
          Body
        </AppDialog>
      </ThemeProvider>,
    );

    const dividers = screen.getAllByRole('separator');
    expect(dividers).toHaveLength(2);
    for (const divider of dividers) {
      expect(divider).toHaveStyle({ borderColor: 'rgba(224, 224, 224, 0.25)' });
    }
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
