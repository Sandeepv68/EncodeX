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
import { Alert, Box } from '@mui/material';
import { useNavigationGuard } from '../NavigationGuardContext';
import PageContainer from '../components/PageContainer';
import { bridgePromise, withBridgeTimeout } from '../utils/bridge-call';
import { useToastStore } from '../stores/toastStore';
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
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          justifyContent: hasActiveChat ? 'flex-start' : 'center',
        }}
      >
        {globalError && (
          <Box sx={{ paddingInline: 2, paddingTop: 2, paddingBottom: 2 }}>
            <Alert
              severity="error"
              data-testid="copilot-error"
              sx={{
                boxShadow: (theme) =>
                  theme.palette.mode === 'dark'
                    ? '0 8px 24px rgba(0, 0, 0, 0.35)'
                    : '0 8px 24px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04)',
                '& .MuiAlert-message': { width: '100%', fontWeight: 600 },
              }}
            >
              {globalError}
            </Alert>
          </Box>
        )}
        {notice && (
          <Box sx={{ paddingInline: 2, paddingTop: 2 , paddingBottom: 2}}>
            <Alert severity="info" data-testid="copilot-notice"  sx={{
                boxShadow: (theme) =>
                  theme.palette.mode === 'dark'
                    ? '0 8px 24px rgba(0, 0, 0, 0.35)'
                    : '0 8px 24px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04)',
                     '& .MuiAlert-message': { width: '100%', fontWeight: 600 },
              }}>
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
          onResetConversation={() => {
            setMessages([]);
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
    </PageContainer>
  );
}
