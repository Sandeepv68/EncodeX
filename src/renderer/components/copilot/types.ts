/**
 * @fileoverview Type definitions for the renderer Copilot components.
 * Declares the prop shapes of the conversation transcript, its message bubble,
 * the assistant plan renderer, the composer and its Lexical input, the
 * provider icon, the MCP App view host, and the saved-conversations drawer.
 */

import type { ReactNode } from 'react';
import type { CopilotOperationChoice, CopilotPlan } from '../../../shared/copilot';
import type { AIProviderId } from '../../../shared/ai/types';
import type { McpViewAttachment } from '../../../shared/mcp-ui';
import type { SavedCopilotChat } from '../../stores/types';

/* ------------------------------------------------------------------ *
 * Conversation
 * ------------------------------------------------------------------ */

/** A single entry in the conversation transcript. */
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  attachments?: string[];
  plan?: CopilotPlan | null;
  error?: string | null;
  notice?: string | null;
  /** The AI provider that produced this assistant message. */
  providerId?: AIProviderId;
  timestamp: number;
}

/** Props for the conversation transcript. */
export interface ConversationProps {
  messages: ConversationMessage[];
  isThinking?: boolean;
  onAddToQueue: (plan: CopilotPlan) => void;
  busy?: boolean;
  /** The currently connected provider, shown as the action icon. */
  providerId?: AIProviderId | null;
}

/* ------------------------------------------------------------------ *
 * MessageBubble
 * ------------------------------------------------------------------ */

/** Props for the chat message bubble. */
export interface MessageBubbleProps {
  speaker: 'user' | 'assistant' | 'thought';
  children: ReactNode;
}

/* ------------------------------------------------------------------ *
 * AssistantMessage
 * ------------------------------------------------------------------ */

/** Props for the assistant plan renderer. */
export interface AssistantMessageProps {
  plan: CopilotPlan | null;
  onAddToQueue: () => void;
  busy?: boolean;
  error?: string | null;
  notice?: string | null;
  /** The currently connected provider; its logo marks each action. */
  providerId?: AIProviderId | null;
}

/* ------------------------------------------------------------------ *
 * ChatComposer
 * ------------------------------------------------------------------ */

/** The active AI connection shown under the composer, when known. */
export interface ComposerConnection {
  connected: boolean;
  providerId?: AIProviderId;
  model?: string;
}

/** Props for the Copilot chat composer. */
export interface ChatComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onChooseFiles: () => void;
  onChooseFolder: () => void;
  onOpenSettings: () => void;
  inputs: string[];
  operation: CopilotOperationChoice;
  onOperationChange: (value: CopilotOperationChoice) => void;
  query: string;
  onQueryChange: (value: string) => void;
  targetLanguage: string;
  onTargetLanguageChange: (value: string) => void;
  onRemoveInput?: (path: string) => void;
  disabled?: boolean;
  busy?: boolean;
  hasInputs?: boolean;
  connection?: ComposerConnection;
  onResetConversation?: () => void;
  showReset?: boolean;
  /** Saves the current transcript; only shown when `showSave` is true. */
  onSaveChat?: () => void;
  showSave?: boolean;
  /** Opens the saved-conversations drawer. */
  onOpenSavedChats?: () => void;
  inputsLoading?: boolean;
}

/* ------------------------------------------------------------------ *
 * ChatInput
 * ------------------------------------------------------------------ */

/** Props for the Lexical-based chat input. */
export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  busy?: boolean;
  hasInputs?: boolean;
  onResetConversation?: () => void;
  showReset?: boolean;
  onResetConfirm?: () => void;
}

/* ------------------------------------------------------------------ *
 * ProviderIcon
 * ------------------------------------------------------------------ */

/** Props for the AI provider icon. */
export interface ProviderIconProps {
  providerId?: AIProviderId | null;
  /** Edge length of the icon in pixels. */
  size?: number;
}

/* ------------------------------------------------------------------ *
 * McpAppView
 * ------------------------------------------------------------------ */

/** Props for the inline MCP App view renderer. */
export interface McpAppViewProps {
  /** The view to render. */
  attachment: McpViewAttachment;
}

/* ------------------------------------------------------------------ *
 * SavedChatsDrawer
 * ------------------------------------------------------------------ */

/** Props for the saved-conversations drawer. */
export interface SavedChatsDrawerProps {
  open: boolean;
  chats: SavedCopilotChat[];
  onClose: () => void;
  onOpen: (chat: SavedCopilotChat) => void;
  onDelete: (id: string) => void;
}
