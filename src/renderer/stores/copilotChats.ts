/**
 * @fileoverview Manually saved Copilot conversations.
 *
 * Nothing is persisted unless the user explicitly saves a chat from the Copilot
 * page. Saved chats live in localStorage under {@link COPILOT_CHATS_STORAGE_KEY}
 * and are validated on every read, so a corrupted or hand-edited entry is
 * dropped instead of breaking the page.
 */

import { Logger } from '../../shared/logger';
import type { ConversationMessage } from '../components/copilot/Conversation';

const log = new Logger('renderer/stores/copilotChats');

/** localStorage key holding the JSON array of saved chats. */
export const COPILOT_CHATS_STORAGE_KEY = 'encodex-copilot-saved-chats';

/** Upper bound on stored chats; the oldest are dropped when exceeded. */
export const MAX_SAVED_COPILOT_CHATS = 50;

/** Maximum characters kept from the first user message when deriving a title. */
const TITLE_MAX_CHARS = 60;

/**
 * A conversation the user chose to keep.
 * @interface SavedCopilotChat
 * @property {string} id - Stable identifier; re-saving the same chat updates it.
 * @property {string} title - Short label derived from the first user message.
 * @property {number} savedAt - Epoch milliseconds of the last save.
 * @property {ConversationMessage[]} messages - The full transcript.
 */
export interface SavedCopilotChat {
  id: string;
  title: string;
  savedAt: number;
  messages: ConversationMessage[];
}

/**
 * Checks that a parsed value has the shape of a ConversationMessage.
 * @param {unknown} value - Candidate message.
 * @returns {boolean} True when the message can be safely rendered.
 */
function isMessage(value: unknown): value is ConversationMessage {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === 'string' &&
    (m.role === 'user' || m.role === 'assistant') &&
    typeof m.timestamp === 'number' &&
    (m.content === undefined || typeof m.content === 'string') &&
    (m.attachments === undefined || (Array.isArray(m.attachments) && m.attachments.every((a) => typeof a === 'string')))
  );
}

/**
 * Checks that a parsed value has the shape of a SavedCopilotChat.
 * @param {unknown} value - Candidate chat.
 * @returns {boolean} True when the chat is usable.
 */
function isSavedChat(value: unknown): value is SavedCopilotChat {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.title === 'string' &&
    typeof c.savedAt === 'number' &&
    Array.isArray(c.messages) &&
    c.messages.every(isMessage)
  );
}

/**
 * Reads the saved chats, newest first. Invalid entries are skipped; a storage
 * or parse failure yields an empty list.
 * @returns {SavedCopilotChat[]} The validated saved chats.
 */
export function readSavedCopilotChats(): SavedCopilotChat[] {
  try {
    const raw = localStorage.getItem(COPILOT_CHATS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedChat).sort((a, b) => b.savedAt - a.savedAt);
  } catch (err) {
    log.warn('Failed to read saved Copilot chats', err);
    return [];
  }
}

/**
 * Writes the full list of saved chats, trimmed to MAX_SAVED_COPILOT_CHATS.
 * @param {SavedCopilotChat[]} chats - The list to store.
 * @returns {void}
 */
function writeSavedCopilotChats(chats: SavedCopilotChat[]): void {
  try {
    localStorage.setItem(COPILOT_CHATS_STORAGE_KEY, JSON.stringify(chats.slice(0, MAX_SAVED_COPILOT_CHATS)));
  } catch (err) {
    log.warn('Failed to write saved Copilot chats', err);
    throw err;
  }
}

/**
 * Saves a chat. An existing entry with the same id is replaced, otherwise the
 * chat is added. Throws if the browser refuses the write (for example quota).
 * @param {SavedCopilotChat} chat - The chat to store.
 * @returns {SavedCopilotChat[]} The updated list, newest first.
 */
export function saveCopilotChat(chat: SavedCopilotChat): SavedCopilotChat[] {
  const others = readSavedCopilotChats().filter((c) => c.id !== chat.id);
  const next = [chat, ...others].sort((a, b) => b.savedAt - a.savedAt);
  writeSavedCopilotChats(next);
  return next;
}

/**
 * Removes a saved chat by id.
 * @param {string} id - The chat id to remove.
 * @returns {SavedCopilotChat[]} The updated list, newest first.
 */
export function deleteCopilotChat(id: string): SavedCopilotChat[] {
  const next = readSavedCopilotChats().filter((c) => c.id !== id);
  writeSavedCopilotChats(next);
  return next;
}

/**
 * Derives a short title from the first user message in a transcript.
 * @param {ConversationMessage[]} messages - The transcript.
 * @returns {string} The trimmed first user message, or an empty string.
 */
export function deriveCopilotChatTitle(messages: ConversationMessage[]): string {
  const first = messages.find((m) => m.role === 'user' && m.content?.trim());
  const text = (first?.content ?? '').trim().replace(/\s+/g, ' ');
  return text.length > TITLE_MAX_CHARS ? `${text.slice(0, TITLE_MAX_CHARS - 1)}…` : text;
}
