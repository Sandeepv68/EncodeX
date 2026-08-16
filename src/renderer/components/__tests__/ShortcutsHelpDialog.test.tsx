/**
 * @fileoverview Unit tests for the shortcuts help dialog.
 *
 * Verifies the dialog renders its title, every registered section with its
 * shortcut rows, exposes a working close button, and stays hidden when closed.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SHORTCUT_SECTIONS, SHORTCUTS } from '../../constants/shortcuts';
import { assertNoAxeViolations } from '../../../test-utils/axe';
import ShortcutsHelpDialog from '../ShortcutsHelpDialog';

describe('ShortcutsHelpDialog', () => {
  it('is hidden when closed', () => {
    render(<ShortcutsHelpDialog open={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId('shortcuts-help-dialog')).not.toBeInTheDocument();
  });

  it('renders the title and an accessible close button', () => {
    render(<ShortcutsHelpDialog open onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'shortcuts.title' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'shortcuts.close' })).toBeInTheDocument();
  });

  it('renders every section title and every shortcut label from the registry', () => {
    render(<ShortcutsHelpDialog open onClose={vi.fn()} />);
    for (const section of SHORTCUT_SECTIONS) {
      expect(screen.getByText(section.labelKey)).toBeInTheDocument();
    }
    for (const spec of SHORTCUTS) {
      expect(screen.getByText(spec.labelKey)).toBeInTheDocument();
    }
  });

  it('closes via the close button', () => {
    const onClose = vi.fn();
    render(<ShortcutsHelpDialog open onClose={onClose} />);
    fireEvent.click(screen.getByTestId('shortcuts-help-close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('has no axe violations', async () => {
    const { container } = render(<ShortcutsHelpDialog open onClose={vi.fn()} />);
    await assertNoAxeViolations(container);
  });
});
