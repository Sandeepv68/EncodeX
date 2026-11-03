/**
 * @fileoverview Type definitions for the renderer Copilot components.
 * Declares the prop shapes of the conversation transcript, its message bubble,
 * the assistant plan renderer, the composer and its Lexical input, the
 * provider icon, the MCP App view host, and the saved-conversations drawer.
 */

import type { ReactNode } from 'react';
import type { CopilotAction, CopilotOperationChoice, CopilotPlan } from '../../../shared/copilot';
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

/** Props for the target-settings summary of a single planned action. */
export interface PlanTargetSummaryProps {
  action: CopilotAction;
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

/**
 * One attachment shown as a card in the composer: the files the user picked
 * (grouped into a single card) or a folder whose media files were collected
 * recursively.
 */
export interface ComposerAttachment {
  /** Stable identity, used as the React key and to remove the attachment. */
  id: string;
  /** True when the attachment stands for a folder rather than picked files. */
  isFolder: boolean;
  /**
   * Display name: the folder name, or the comma-separated names of the picked
   * files.
   */
  label: string;
  /** Absolute paths of the media files this attachment covers. */
  paths: string[];
}

/** Props for the Copilot chat composer. */
export interface ChatComposerProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onChooseFiles: () => void;
  onChooseFolder: () => void;
  onOpenSettings: () => void;
  /** The attachments shown as cards above the input. */
  attachments: ComposerAttachment[];
  operation: CopilotOperationChoice;
  onOperationChange: (value: CopilotOperationChoice) => void;
  query: string;
  onQueryChange: (value: string) => void;
  targetLanguage: string;
  onTargetLanguageChange: (value: string) => void;
  /** Removes the attachment with the given id. */
  onRemoveAttachment?: (id: string) => void;
  disabled?: boolean;
  busy?: boolean;
  hasInputs?: boolean;
  connection?: ComposerConnection;
  onResetConversation?: () => void;
  showReset?: boolean;
  /** Saves the current transcript; only shown when `showSave` is true. */
  onSaveChat?: () => void;
  onSaveAndResetConversation?: () => void;
  showSaveAndReset?: boolean;
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
  onSaveAndResetConversation?: () => void;
  showSaveAndReset?: boolean;
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
