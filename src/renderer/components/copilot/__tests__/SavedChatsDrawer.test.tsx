import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SavedChatsDrawer from '../SavedChatsDrawer';
import type { SavedCopilotChat } from '../../../stores/copilotChats';

function chat(overrides: Partial<SavedCopilotChat> = {}): SavedCopilotChat {
  return {
    id: 'chat-1',
    title: 'First chat',
    savedAt: 1_700_000_000_000,
    messages: [],
    ...overrides,
  };
}

function renderDrawer(chats: SavedCopilotChat[]) {
  const onClose = vi.fn();
  const onOpen = vi.fn();
  const onDelete = vi.fn();
  const result = render(<SavedChatsDrawer open chats={chats} onClose={onClose} onOpen={onOpen} onDelete={onDelete} />);
  return { result, onClose, onOpen, onDelete };
}

describe('SavedChatsDrawer', () => {
  it('shows the empty state when there are no saved chats', () => {
    renderDrawer([]);
    expect(screen.getByTestId('saved-chats-drawer')).toHaveAttribute('aria-label', 'copilot.savedChatsTitle');
    expect(screen.getByTestId('saved-chats-empty')).toHaveTextContent('copilot.savedChatsEmpty');
    expect(screen.queryByTestId('saved-chat-item')).not.toBeInTheDocument();
  });

  it('lists saved chats with their title, message count and untitled fallback', () => {
    const first = chat({ id: 'a', title: 'Bug triage', messages: [{ id: 'm1', role: 'user', content: 'hi', timestamp: 1 }] });
    const second = chat({ id: 'b', title: '' });
    renderDrawer([first, second]);

    expect(screen.getByText('Bug triage')).toBeInTheDocument();
    expect(screen.getByText('copilot.savedChatUntitled')).toBeInTheDocument();
    expect(screen.getAllByTestId('saved-chat-item')).toHaveLength(2);
    expect(screen.getAllByText('copilot.savedChatMeta')).toHaveLength(2);
  });

  it('fires onOpen with the selected chat', () => {
    const first = chat({ id: 'a', title: 'Bug triage' });
    const second = chat({ id: 'b', title: 'Release notes' });
    const { onOpen } = renderDrawer([first, second]);

    const items = screen.getAllByTestId('saved-chat-item');
    fireEvent.click(within(items[1]).getByRole('button', { name: 'copilot.savedChatOpen' }));

    expect(onOpen).toHaveBeenCalledWith(second);
  });

  it('fires onDelete with the selected chat id', () => {
    const { onDelete } = renderDrawer([chat({ id: 'a' }), chat({ id: 'b' })]);
    const items = screen.getAllByTestId('saved-chat-item');
    fireEvent.click(within(items[0]).getByRole('button', { name: 'copilot.savedChatDelete' }));
    expect(onDelete).toHaveBeenCalledWith('a');
  });

  it('fires onClose from the close button', () => {
    const { onClose } = renderDrawer([]);
    fireEvent.click(screen.getByRole('button', { name: 'copilot.savedChatsClose' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
