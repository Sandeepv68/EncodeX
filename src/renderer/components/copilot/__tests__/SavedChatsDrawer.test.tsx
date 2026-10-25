import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SavedChatsDrawer, { formatTimeAgo } from '../SavedChatsDrawer';
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

describe('formatTimeAgo', () => {
  const now = 1_700_000_000_000;
  it.each([
    [now - 5_000, /5 sec\. ago/],
    [now - 5 * 60_000, /5 min\. ago/],
    [now - 3 * 3_600_000, /3 hr\. ago/],
    [now - 2 * 86_400_000, /2 days ago/],
  ])('formats elapsed time %#', (timestamp, expected) => {
    expect(formatTimeAgo(timestamp, now, 'en-US')).toMatch(expected);
  });

  it('treats future timestamps as just now', () => {
    expect(formatTimeAgo(now + 10_000, now, 'en-US')).toMatch(/0 sec\. ago/);
  });
});

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
    expect(screen.getAllByTestId('saved-chat-count').map((el) => el.textContent)).toEqual(['1', '0']);
  });

  it('fires onOpen when the entry itself is clicked', () => {
    const first = chat({ id: 'a', title: 'Bug triage' });
    const second = chat({ id: 'b', title: 'Release notes' });
    const { onOpen } = renderDrawer([first, second]);

    const items = screen.getAllByTestId('saved-chat-item');
    fireEvent.click(within(items[1]).getByTestId('saved-chat-open'));

    expect(onOpen).toHaveBeenCalledWith(second);
  });

  it('has no separate open button; only delete sits outside the entry', () => {
    renderDrawer([chat({ id: 'a' })]);
    expect(screen.queryByRole('button', { name: 'copilot.savedChatOpen' })).toBeNull();
    expect(screen.getByRole('button', { name: 'copilot.savedChatDelete' })).toBeInTheDocument();
  });

  it('shows a provider icon on every chat item, using the provider recorded for that chat', () => {
    renderDrawer([
      chat({
        id: 'a',
        messages: [{ id: 'm1', role: 'assistant', plan: null, providerId: 'openai', timestamp: 1 }],
      }),
      chat({ id: 'b' }),
    ]);
    const items = screen.getAllByTestId('saved-chat-item');
    expect(within(items[0]).getByTestId('saved-chat-provider')).toBeInTheDocument();
    expect(within(items[1]).getByTestId('saved-chat-provider')).toBeInTheDocument();
  });

  it('renders the delete control as a red cross', () => {
    renderDrawer([chat({ id: 'a' })]);
    const del = screen.getByRole('button', { name: 'copilot.savedChatDelete' });
    expect(del).toHaveClass('MuiIconButton-colorError');
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
