/**
 * @fileoverview Responsive and accessibility guards for the Copilot page.
 *
 * The layout itself is CSS-only, so these tests assert the behaviour that must
 * survive the responsive changes: icon-only actions keep accessible names, the
 * plan button remains named while busy, the saved-chats overlay is present only
 * while open, and the composer renders in RTL.
 */

import { useState, type ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ColorModeProvider } from '../ColorModeContext';
import ChatInput from '../components/copilot/ChatInput';
import ChatComposer from '../components/copilot/ChatComposer';
import SavedChatsDrawer from '../components/copilot/SavedChatsDrawer';
import type { CopilotOperationChoice } from '../../shared/copilot';
import type { ComposerAttachment } from '../components/copilot/types';

afterEach(() => {
  cleanup();
  document.documentElement.dir = 'ltr';
});

/**
 * Controlled harness around {@link ChatInput}.
 * @param {object} props - Harness props.
 * @param {string} props.value - The controlled value.
 * @param {boolean} [props.busy] - Whether a plan request is in flight.
 * @returns {JSX.Element} The harness.
 */
function InputHarness({ value, busy = false }: { value: string; busy?: boolean }) {
  const [text, setText] = useState(value);
  return (
    <ColorModeProvider>
      <ChatInput value={text} onChange={setText} onSubmit={vi.fn()} busy={busy} hasInputs />
    </ColorModeProvider>
  );
}

/**
 * Renders the composer with sensible defaults.
 * @param {Partial<ComponentProps<typeof ChatComposer>>} [overrides] - Props that
 *   replace the defaults for a specific scenario.
 * @returns {void}
 */
function renderComposer(overrides: Partial<ComponentProps<typeof ChatComposer>> = {}): void {
  render(
    <ColorModeProvider>
      <ChatComposer
        input=""
        onInputChange={vi.fn()}
        onSubmit={vi.fn()}
        onChooseFiles={vi.fn()}
        onChooseFolder={vi.fn()}
        onOpenSettings={vi.fn()}
        attachments={[] as ComposerAttachment[]}
        operation={'auto' as CopilotOperationChoice}
        onOperationChange={vi.fn()}
        query=""
        onQueryChange={vi.fn()}
        targetLanguage=""
        onTargetLanguageChange={vi.fn()}
        {...overrides}
      />
    </ColorModeProvider>,
  );
}

describe('Copilot responsive accessibility', () => {
  it('keeps accessible names on the icon-only composer actions', () => {
    renderComposer();

    for (const [testId, label] of [
      ['copilot-choose-files', 'copilot.chooseFiles'],
      ['copilot-choose-folder', 'copilot.chooseFolder'],
      ['copilot-advanced', 'copilot.advanced'],
      ['copilot-ai-settings', 'copilot.ai.configure'],
    ] as const) {
      const button = screen.getByTestId(testId);
      expect(button).toHaveAttribute('aria-label', label);
      expect(button).toHaveTextContent(label);
    }
  });

  it('keeps the provider logo at the end of the input and the configure control on the action row', async () => {
    renderComposer({
      showSave: true,
      onOpenSavedChats: vi.fn(),
      showSaveAndReset: true,
      onSaveAndResetConversation: vi.fn(),
      connection: { connected: true, providerId: 'openai', model: 'gpt-4o-mini' },
    });

    const statusButton = screen.getByTestId('copilot-ai-status-button');
    expect(screen.getByTestId('copilot-ai-settings')).toBeInTheDocument();

    // The logo sits after the plan button, at the right end of the input.
    const planButton = screen.getByTestId('copilot-plan');
    expect(planButton.compareDocumentPosition(statusButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    // The status itself lives in a popover that opens on click.
    expect(screen.queryByTestId('copilot-ai-status')).not.toBeInTheDocument();
    fireEvent.click(statusButton);
    expect(await screen.findByTestId('copilot-ai-status')).toBeInTheDocument();
  });

  it('closes the provider status popover on Escape', async () => {
    renderComposer({
      connection: { connected: true, providerId: 'openai', model: 'gpt-4o-mini' },
    });

    const statusButton = screen.getByTestId('copilot-ai-status-button');
    fireEvent.click(statusButton);
    expect(await screen.findByTestId('copilot-ai-status')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByTestId('copilot-ai-status-popover'), { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('copilot-ai-status')).not.toBeInTheDocument());
  });

  it('keeps the plan button named while a request is in flight', () => {
    render(<InputHarness value="compress for web" busy />);
    expect(screen.getByRole('button', { name: 'copilot.planning' })).toBeInTheDocument();
  });

  it('renders the composer in RTL without changing its accessible names', () => {
    document.documentElement.dir = 'rtl';
    renderComposer();
    expect(screen.getByRole('button', { name: 'copilot.chooseFiles' })).toBeInTheDocument();
  });

  it('shows the saved-chats backdrop only while the drawer is open', async () => {
    const onClose = vi.fn();
    const props = {
      chats: [],
      onClose,
      onOpen: vi.fn(),
      onDelete: vi.fn(),
    };

    const { rerender } = render(
      <ColorModeProvider>
        <SavedChatsDrawer open={false} {...props} />
      </ColorModeProvider>,
    );
    expect(screen.queryByTestId('saved-chats-backdrop')).toBeNull();

    await act(async () => {
      rerender(
        <ColorModeProvider>
          <SavedChatsDrawer open {...props} />
        </ColorModeProvider>,
      );
    });

    expect(screen.getByTestId('saved-chats-backdrop')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('saved-chats-close')).toHaveFocus());

    await act(async () => {
      fireEvent.click(screen.getByTestId('saved-chats-backdrop'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes the saved-chats drawer on Escape', () => {
    const onClose = vi.fn();
    render(
      <ColorModeProvider>
        <SavedChatsDrawer open chats={[]} onClose={onClose} onOpen={vi.fn()} onDelete={vi.fn()} />
      </ColorModeProvider>,
    );

    fireEvent.keyDown(screen.getByTestId('saved-chats-drawer'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
