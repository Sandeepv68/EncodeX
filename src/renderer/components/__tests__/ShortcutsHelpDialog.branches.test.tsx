import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../constants/shortcuts', () => ({
  SHORTCUT_SECTIONS: [{ id: 'empty', labelKey: 'section.empty' }],
  SHORTCUTS: [],
  formatShortcut: () => '',
}));

import ShortcutsHelpDialog from '../ShortcutsHelpDialog';

describe('ShortcutsHelpDialog branches', () => {
  it('omits sections with no shortcuts', () => {
    render(<ShortcutsHelpDialog open onClose={vi.fn()} />);
    expect(screen.queryByText('section.empty')).not.toBeInTheDocument();
  });
});
