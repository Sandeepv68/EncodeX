import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COPILOT_CHATS_STORAGE_KEY,
  MAX_SAVED_COPILOT_CHATS,
  deleteCopilotChat,
  deriveCopilotChatTitle,
  readSavedCopilotChats,
  saveCopilotChat,
  type SavedCopilotChat,
} from '../copilotChats';
import type { ConversationMessage } from '../../components/copilot/Conversation';
import { expectAppLog } from '../../../test-utils/crash-tripwire';

const msg = (content: string): ConversationMessage => ({ id: `u-${content}`, role: 'user', content, timestamp: 1 });

const chat = (id: string, savedAt: number, text = 'hello'): SavedCopilotChat => ({
  id,
  title: text,
  savedAt,
  messages: [msg(text)],
});

describe('copilotChats storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty and writes nothing until a chat is saved', () => {
    expect(readSavedCopilotChats()).toEqual([]);
    expect(localStorage.getItem(COPILOT_CHATS_STORAGE_KEY)).toBeNull();
  });

  it('saves and reads back chats newest first', () => {
    saveCopilotChat(chat('a', 1));
    saveCopilotChat(chat('b', 3));
    expect(readSavedCopilotChats().map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('replaces an entry with the same id instead of duplicating it', () => {
    saveCopilotChat(chat('a', 1, 'first'));
    saveCopilotChat(chat('a', 2, 'second'));
    const all = readSavedCopilotChats();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('second');
  });

  it('deletes by id', () => {
    saveCopilotChat(chat('a', 1));
    saveCopilotChat(chat('b', 2));
    expect(deleteCopilotChat('a').map((c) => c.id)).toEqual(['b']);
    expect(readSavedCopilotChats().map((c) => c.id)).toEqual(['b']);
  });

  it('drops corrupted and malformed entries on read', () => {
    localStorage.setItem(
      COPILOT_CHATS_STORAGE_KEY,
      JSON.stringify([chat('ok', 1), { id: 'bad', title: 'x', savedAt: 1, messages: [{ role: 'nope' }] }, 'junk']),
    );
    expect(readSavedCopilotChats().map((c) => c.id)).toEqual(['ok']);
  });

  it('returns an empty list when the stored value is not JSON', () => {
    localStorage.setItem(COPILOT_CHATS_STORAGE_KEY, '{not json');
    expectAppLog('warn', 'renderer/stores/copilotChats');
    expect(readSavedCopilotChats()).toEqual([]);
  });

  it('caps the stored list at MAX_SAVED_COPILOT_CHATS', () => {
    for (let i = 0; i < MAX_SAVED_COPILOT_CHATS + 5; i += 1) {
      saveCopilotChat(chat(`c${i}`, i));
    }
    expect(readSavedCopilotChats()).toHaveLength(MAX_SAVED_COPILOT_CHATS);
  });

  it('logs and rethrows when the storage write fails', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    try {
      expectAppLog('warn', 'renderer/stores/copilotChats');
      expect(() => saveCopilotChat(chat('a', 1))).toThrow('quota exceeded');
    } finally {
      setItemSpy.mockRestore();
    }
  });
});

describe('deriveCopilotChatTitle', () => {
  it('uses the first user message, collapsing whitespace', () => {
    expect(deriveCopilotChatTitle([msg('  convert   this\nfile ')])).toBe('convert this file');
  });

  it('truncates long titles', () => {
    const title = deriveCopilotChatTitle([msg('x'.repeat(200))]);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith('…')).toBe(true);
  });

  it('returns an empty string when there is no user text', () => {
    expect(deriveCopilotChatTitle([])).toBe('');
  });
});
