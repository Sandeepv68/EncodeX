/**
 * @fileoverview Covers the reset-conversation confirmation dialog in ChatInput:
 * cancel, Escape-to-dismiss, and confirm.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { ColorModeProvider } from '../../ColorModeContext';
import ChatInput from '../copilot/ChatInput';

/**
 * Renders the composer with the reset control enabled.
 * @param {() => void} onResetConversation - Spy for the confirmed reset.
 * @returns {void}
 */
function renderWithReset(onResetConversation: () => void): void {
  render(
    <ColorModeProvider>
      <ChatInput value="" onChange={() => {}} onSubmit={() => {}} showReset onResetConversation={onResetConversation} />
    </ColorModeProvider>,
  );
}

describe('ChatInput reset confirmation', () => {
  it('opens the dialog from the reset control and cancels without resetting', async () => {
    const onReset = vi.fn();
    renderWithReset(onReset);

    fireEvent.click(screen.getByTestId('copilot-reset-conversation'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getAllByRole('button')[0]);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onReset).not.toHaveBeenCalled();
  });

  it('dismisses the dialog on Escape without resetting', async () => {
    const onReset = vi.fn();
    renderWithReset(onReset);

    fireEvent.click(screen.getByTestId('copilot-reset-conversation'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onReset).not.toHaveBeenCalled();
  });

  it('calls onResetConversation when the reset is confirmed', async () => {
    const onReset = vi.fn();
    renderWithReset(onReset);

    fireEvent.click(screen.getByTestId('copilot-reset-conversation'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getAllByRole('button')[1]);

    await waitFor(() => expect(onReset).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
