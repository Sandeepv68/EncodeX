/**
 * @fileoverview Copilot page (ChatGPT-style conversation UI with a Lexical
 * composer).
 *
 * Renderer surface for the EncodeX planner: the user describes a goal with
 * optional file attachments and the assistant returns a plan (ready-to-enqueue
 * actions or read-only analysis results). Committing a plan reuses the existing
 * Batch Queue — this page never starts a conversion itself.
 *
 * The page is deliberately inert on mount: it calls the preload bridge only in
 * event handlers. Bridge calls are wrapped in {@link bridgePromise} +
 * {@link withBridgeTimeout} so a missing, throwing, or hung bridge degrades to an
 * inline error instead of crashing the tree.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import {
  deleteCopilotChat,
  deriveCopilotChatTitle,
  readSavedCopilotChats,
  saveCopilotChat,
  type SavedCopilotChat,
} from '../stores/copilotChats';
import SavedChatsDrawer from '../components/copilot/SavedChatsDrawer';
import { useNavigationGuard } from '../NavigationGuardContext';
import PageContainer from '../components/PageContainer';
import { bridgePromise, withBridgeTimeout } from '../utils/bridge-call';
import { useToastStore } from '../stores/toastStore';
import { SHADOWS } from '../colors';
import { TRANSCODER_TYPES } from '../../shared/transcoder-constants';
import type { CopilotOperationChoice, CopilotPlan } from '../../shared/copilot';
import { formatError } from '../../shared/errors';
import Conversation, { type ConversationMessage } from '../components/copilot/Conversation';
import ChatComposer from '../components/copilot/ChatComposer';
import { activeConnectionOf, useAiConnectionStore } from '../stores/aiConnectionStore';

/** How long the plan request may take before the page shows a failure. */
const PLAN_TIMEOUT_MS = 60_000;
/** How long a file/folder dialog may take before the page gives up. */
const FOLDER_TIMEOUT_MS = 30_000;

/**
 * Renders the Copilot page (`/copilot`).
 * @returns {JSX.Element} The page content.
 */
export default function Copilot() {
  const { t } = useTranslation();
  const { navigate, navigateWithoutGuard, registerGuard } = useNavigationGuard();

  /** The conversation transcript. */
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  /** The composer's current text. */
  const [input, setInput] = useState('');
  /** Media files picked by the user (files and/or a folder). */
  const [inputs, setInputs] = useState<string[]>([]);
  /** The forced operation, or 'auto' to let the planner decide. */
  const [operation, setOperation] = useState<CopilotOperationChoice>('auto');
  /** Passage to look for when searching a transcript. */
  const [query, setQuery] = useState('');
  /** Target language when translating subtitles. */
  const [targetLanguage, setTargetLanguage] = useState('');
  /** True while a plan is being built or jobs are being enqueued. */
  const [busy, setBusy] = useState(false);
  /** True while the assistant placeholder is waiting for a plan. */
  const [isThinking, setIsThinking] = useState(false);
  /** Inline error message, or null when healthy. */
  const [globalError, setGlobalError] = useState<string | null>(null);
  /** Informational notice, or null. */
  const [notice, setNotice] = useState<string | null>(null);
  /** The mirrored AI settings view, hydrated once at store load. */
  const aiView = useAiConnectionStore((state) => state.view);
  /** The single active AI connection, if any. */
  const aiConnection = activeConnectionOf(aiView);

  /** Whether the transcript holds messages that would be lost on navigation. */
  const hasActiveChat = messages.length > 0;

  /** True while file/folder selection dialog is resolving. */
  const [inputsLoading, setInputsLoading] = useState(false);
  /** Id of the saved chat this transcript is linked to, or null if never saved. */
  const [savedChatId, setSavedChatId] = useState<string | null>(null);
  /** Saved chat waiting for the user's decision about the open transcript. */
  const [pendingChat, setPendingChat] = useState<SavedCopilotChat | null>(null);
  /** Whether the saved-conversations drawer is open. */
  const [savedChatsOpen, setSavedChatsOpen] = useState(false);
  /** Saved conversations shown in the dialog; read from storage each time it opens. */
  const [savedChats, setSavedChats] = useState<SavedCopilotChat[]>([]);

  /**
   * Saves the current transcript when the user asks for it. Nothing is written
   * automatically. Re-saving an already linked chat updates that entry.
   * @returns {boolean} True when the chat was written to storage.
   */
  const handleSaveChat = (): boolean => {
    const id = savedChatId ?? `chat-${Date.now()}`;
    try {
      saveCopilotChat({
        id,
        title: deriveCopilotChatTitle(messages),
        savedAt: Date.now(),
        messages,
      });
      setSavedChatId(id);
      useToastStore.getState().success(t('copilot.chatSaved'));
      return true;
    } catch {
      setGlobalError(t('copilot.savedChatSaveFailed'));
      return false;
    }
  };

  /**
   * Opens the saved-conversations dialog with a fresh read from storage.
   * @returns {void}
   */
  const openSavedChats = (): void => {
    setSavedChats(readSavedCopilotChats());
    setSavedChatsOpen(true);
  };

  /**
   * Replaces the current transcript with a saved conversation and links the
   * page to it, so later saves update that entry.
   * @param {SavedCopilotChat} chat - The chat to load.
   * @returns {void}
   */
  const loadChat = (chat: SavedCopilotChat): void => {
    setMessages(chat.messages);
    setSavedChatId(chat.id);
    setInput('');
    setInputs([]);
    setGlobalError(null);
    setNotice(null);
    setSavedChatsOpen(false);
  };

  /**
   * Handles a request to open a saved chat. When the current transcript has
   * messages and is not that same saved chat, the user is asked first so an
   * unsaved transcript is never discarded silently.
   * @param {SavedCopilotChat} chat - The chat the user picked.
   * @returns {void}
   */
  const handleOpenChat = (chat: SavedCopilotChat): void => {
    if (hasActiveChat && chat.id !== savedChatId) {
      setPendingChat(chat);
      return;
    }
    loadChat(chat);
  };

  /**
   * Resolves the open-chat confirmation. Saving first is skipped (and the
   * switch cancelled) when the save fails, so the transcript is not lost.
   * @param {'save' | 'discard'} choice - Whether to keep the current transcript.
   * @returns {void}
   */
  const resolvePendingChat = (choice: 'save' | 'discard'): void => {
    const chat = pendingChat;
    setPendingChat(null);
    if (!chat) return;
    if (choice === 'save' && !handleSaveChat()) return;
    loadChat(chat);
  };

  /**
   * Deletes a saved conversation and refreshes the dialog list. If the open
   * transcript is linked to it, the link is cleared so the next save creates a
   * new entry.
   * @param {string} id - The saved chat id to remove.
   * @returns {void}
   */
  const handleDeleteChat = (id: string): void => {
    setSavedChats(deleteCopilotChat(id));
    if (savedChatId === id) setSavedChatId(null);
  };

  useEffect(() => registerGuard(() => hasActiveChat), [registerGuard, hasActiveChat]);

  /**
   * Opens the folder dialog (recursively) and replaces the current inputs.
   * @returns {Promise<void>} Resolves after the selection is stored.
   */
  const chooseFolder = async (): Promise<void> => {
    setGlobalError(null);
    setNotice(null);
    setInputsLoading(true);
    try {
      const files = await withBridgeTimeout(
        bridgePromise(() => window.electronAPI.selectFolderFiles()),
        FOLDER_TIMEOUT_MS,
        null,
      );
      setInputsLoading(false);
      if (files && Array.isArray(files) && files.length > 0) {
        setInputs(files);
      } else if (Array.isArray(files) && files.length === 0) {
        setNotice(t('copilot.folderEmpty'));
      }
    } catch {
      setInputsLoading(false);
      setGlobalError(t('copilot.dialogFailed'));
    }
  };

  /**
   * Opens the multi-file dialog and appends the chosen files to the inputs.
   * @returns {Promise<void>} Resolves after the selection is merged.
   */
  const chooseFiles = async (): Promise<void> => {
    setGlobalError(null);
    setNotice(null);
    setInputsLoading(true);
    try {
      const files = await withBridgeTimeout(
        bridgePromise(() => window.electronAPI.selectFiles()),
        FOLDER_TIMEOUT_MS,
        null,
      );
      setInputsLoading(false);
      if (files && Array.isArray(files) && files.length > 0) {
        setInputs((current) => [...new Set([...current, ...files])]);
      } else if (Array.isArray(files) && files.length === 0) {
        setNotice(t('copilot.filesEmpty'));
      }
    } catch {
      setInputsLoading(false);
      setGlobalError(t('copilot.dialogFailed'));
    }
  };

  /**
   * Removes one attachment from the composer.
   * @param {string} path - The path to drop.
   * @returns {void}
   */
  const removeInput = (path: string): void => {
    setInputs((current) => current.filter((p) => p !== path));
  };

  /**
   * Opens the Settings page where AI providers are configured.
   * @returns {void}
   */
  const openSettings = (): void => {
    navigate('/settings');
  };

  /**
   * Asks main to plan the goal against the chosen inputs and resolves the
   * optimistic assistant message with the plan (or drops it on failure).
   * @returns {Promise<void>} Resolves once the plan (or the error) is stored.
   */
  const buildPlan = async (): Promise<void> => {
    const goalText = input.trim();
    if (goalText === '') {
      setGlobalError(t('copilot.errorNoGoal'));
      return;
    }
    if (inputs.length === 0) {
      setGlobalError(t('copilot.errorNoInputs'));
      return;
    }

    const userMessage: ConversationMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: goalText,
      attachments: [...inputs],
      timestamp: Date.now(),
    };
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: ConversationMessage = {
      id: assistantMessageId,
      role: 'assistant',
      plan: null,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setBusy(true);
    setIsThinking(true);
    setGlobalError(null);
    setNotice(null);

    const failWith = (message: string): void => {
      setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId));
      setGlobalError(message);
    };

    try {
      const result = await withBridgeTimeout(
        bridgePromise(() =>
          window.electronAPI.copilotPlan({
            goal: goalText,
            inputs,
            recursive: true,
            maxFiles: 50,
            ...(operation !== 'auto' ? { operation } : {}),
            ...(operation === 'search_transcript' && query.trim() ? { query: query.trim() } : {}),
            ...(operation === 'translate' && targetLanguage.trim() ? { targetLanguage: targetLanguage.trim() } : {}),
          }),
        ),
        PLAN_TIMEOUT_MS,
        null,
      );

      if (!result) {
        failWith(t('copilot.bridgeTimeout'));
        return;
      }

      if (Array.isArray(result.actions) && Array.isArray(result.skips)) {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMessageId ? { ...m, plan: result as CopilotPlan, error: null, notice: null } : m)),
        );
      } else {
        failWith(t('copilot.planFailed'));
      }
    } catch (e) {
      failWith(formatError(e).message);
    } finally {
      setBusy(false);
      setIsThinking(false);
    }
  };

  /**
   * Enqueues every planned action into the Batch Queue through the existing
   * bridge, then navigates there when the whole plan was accepted.
   * @param {CopilotPlan} planToEnqueue - The plan to commit.
   * @returns {Promise<void>} Resolves after the enqueues settle.
   */
  const addToQueue = async (planToEnqueue: CopilotPlan): Promise<void> => {
    if (!planToEnqueue || planToEnqueue.actions.length === 0) return;
    setGlobalError(null);
    setNotice(null);
    setBusy(true);
    let added = 0;
    for (const action of planToEnqueue.actions) {
      try {
        await bridgePromise(() =>
          window.electronAPI.queueAdd(action.input, action.output ?? '', action.options, TRANSCODER_TYPES[0], false),
        );
        added += 1;
      } catch {
        // The queue reports its own failures per job; count and continue.
      }
    }
    setBusy(false);
    if (added > 0) {
      useToastStore.getState().success(t('copilot.addedToQueue', { count: added }));
    }
    if (added === planToEnqueue.actions.length && planToEnqueue.actions.length > 0) {
      navigateWithoutGuard('/batch');
    } else if (added > 0) {
      setGlobalError(t('copilot.partiallyAdded'));
    } else {
      setGlobalError(t('copilot.errorEnqueue'));
    }
  };

  return (
    <PageContainer title="" paper={false} fill>
      {/*
        MainContent (App.styles.ts) pads every route by spacing(2) / spacing(3).
        The negative margins below cancel that padding for this page so the saved-chats
        panel sits flush to the top, bottom and left edges; the conversation column
        re-applies the same padding so its content position is unchanged.
      */}
      <Box
        sx={(theme) => ({
          display: 'flex',
          flexDirection: 'row',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          marginInline: theme.spacing(-2),
          marginTop: theme.spacing(-2),
          [theme.breakpoints.up('sm')]: {
            marginInline: theme.spacing(-3),
            marginTop: theme.spacing(-3),
          },
        })}
      >
        <SavedChatsDrawer
          open={savedChatsOpen}
          chats={savedChats}
          onClose={() => setSavedChatsOpen(false)}
          onOpen={handleOpenChat}
          onDelete={handleDeleteChat}
        />
        <Box
          sx={(theme) => ({
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            justifyContent: hasActiveChat ? 'flex-start' : 'center',
            paddingInline: theme.spacing(2),
            paddingTop: theme.spacing(2),
            paddingBottom: theme.spacing(2),
            [theme.breakpoints.up('sm')]: {
              paddingInline: theme.spacing(3),
              paddingTop: theme.spacing(3),
              paddingBottom: theme.spacing(3),
            },
          })}
        >
          <Dialog
            open={pendingChat !== null}
            onClose={() => setPendingChat(null)}
            aria-labelledby="open-chat-confirm-title"
            data-testid="open-chat-confirm"
          >
            <DialogTitle id="open-chat-confirm-title">{t('copilot.openChatConfirmTitle')}</DialogTitle>
            <DialogContent>
              <DialogContentText>{t('copilot.openChatConfirmMessage')}</DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPendingChat(null)} data-testid="open-chat-cancel">
                {t('copilot.openChatCancel')}
              </Button>
              <Button onClick={() => resolvePendingChat('discard')} color="error" data-testid="open-chat-discard">
                {t('copilot.openChatDiscard')}
              </Button>
              <Button variant="contained" onClick={() => resolvePendingChat('save')} data-testid="open-chat-save">
                {t('copilot.openChatSave')}
              </Button>
            </DialogActions>
          </Dialog>
          {globalError && (
            <Box sx={{ paddingInline: 2, paddingTop: 2, paddingBottom: 2 }}>
              <Alert
                severity="error"
                data-testid="copilot-error"
                sx={{
                  boxShadow: (theme) => (theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT),
                  '& .MuiAlert-message': { width: '100%', fontWeight: 600 },
                }}
              >
                {globalError}
              </Alert>
            </Box>
          )}
          {notice && (
            <Box sx={{ paddingInline: 2, paddingTop: 2, paddingBottom: 2 }}>
              <Alert
                severity="info"
                data-testid="copilot-notice"
                sx={{
                  boxShadow: (theme) => (theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT),
                  '& .MuiAlert-message': { width: '100%', fontWeight: 600 },
                }}
              >
                {notice}
              </Alert>
            </Box>
          )}
          <Conversation messages={messages} isThinking={isThinking} onAddToQueue={addToQueue} busy={busy} />
          <ChatComposer
            input={input}
            onInputChange={setInput}
            onSubmit={buildPlan}
            onChooseFiles={chooseFiles}
            onChooseFolder={chooseFolder}
            onOpenSettings={openSettings}
            inputs={inputs}
            operation={operation}
            onOperationChange={setOperation}
            query={query}
            onQueryChange={setQuery}
            targetLanguage={targetLanguage}
            onTargetLanguageChange={setTargetLanguage}
            onRemoveInput={removeInput}
            disabled={busy || inputsLoading}
            busy={busy || inputsLoading}
            hasInputs={inputs.length > 0}
            connection={{
              connected: aiConnection !== null,
              ...(aiConnection ? { providerId: aiConnection.providerId, model: aiConnection.model } : {}),
            }}
            showReset={hasActiveChat}
            showSave={hasActiveChat}
            onSaveChat={handleSaveChat}
            onOpenSavedChats={openSavedChats}
            onResetConversation={() => {
              setMessages([]);
              setSavedChatId(null);
              setInput('');
              setInputs([]);
              setOperation('auto');
              setQuery('');
              setTargetLanguage('');
              setGlobalError(null);
              setNotice(null);
              setIsThinking(false);
            }}
            inputsLoading={inputsLoading}
          />
        </Box>
      </Box>
    </PageContainer>
  );
}
