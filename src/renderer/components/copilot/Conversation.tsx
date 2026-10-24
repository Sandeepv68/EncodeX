/**
 * @fileoverview Conversation transcript: renders the virtualized message
 * stream, the "thinking" indicator and the empty-state welcome.
 */

import { useEffect, useMemo, useRef } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { measureElement as measureElementDefault, observeElementRect, useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import type { CopilotPlan } from '../../../shared/copilot';
import MessageBubble from './MessageBubble';
import AssistantMessage from './AssistantMessage';
import Welcome from './Welcome';
import {
  ConversationScroll,
  ConversationStream,
  TypingDots,
  VirtualConversationStream,
  VirtualRow,
} from '../../styles/copilot/Conversation.styles';

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  attachments?: string[];
  plan?: CopilotPlan | null;
  error?: string | null;
  notice?: string | null;
  timestamp: number;
}

interface ConversationProps {
  messages: ConversationMessage[];
  isThinking?: boolean;
  onAddToQueue: (plan: CopilotPlan) => void;
  busy?: boolean;
}

const FALLBACK_VIEWPORT_HEIGHT = 640;
const THINKING_ROW_ESTIMATE = 72;
const USER_ROW_ESTIMATE = 88;
const ASSISTANT_ROW_ESTIMATE = 280;

/**
 * Renders the scrolling conversation transcript.
 * @param {ConversationProps} props - Component props.
 * @returns {JSX.Element} The transcript.
 */
export default function Conversation({ messages, isThinking = false, onAddToQueue, busy = false }: ConversationProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);

  const visibleMessages = useMemo(
    () => messages.filter((message) => message.role === 'user' || message.plan || message.error || message.notice),
    [messages],
  );
  const rowCount = visibleMessages.length + (isThinking ? 1 : 0);
  const rowGap = parseFloat(theme.spacing(2));
  const verticalPadding = parseFloat(theme.spacing(2));

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      if (index >= visibleMessages.length) return THINKING_ROW_ESTIMATE;
      return visibleMessages[index]?.role === 'user' ? USER_ROW_ESTIMATE : ASSISTANT_ROW_ESTIMATE;
    },
    getItemKey: (index) => visibleMessages[index]?.id ?? 'thinking',
    overscan: 4,
    gap: rowGap,
    paddingStart: verticalPadding,
    paddingEnd: verticalPadding,
    anchorTo: 'end',
    followOnAppend: true,
    observeElementRect: (instance, callback) =>
      observeElementRect(instance, (rect) => callback({ ...rect, height: rect.height || FALLBACK_VIEWPORT_HEIGHT })),
    measureElement: (element, entry, instance) =>
      measureElementDefault(element, entry, instance) || instance.options.estimateSize(instance.indexFromElement(element)),
  });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || rowCount === 0) return;
    virtualizer.scrollToIndex(rowCount - 1, { align: 'end' });
    element.scrollTop = element.scrollHeight;
  }, [messages, isThinking, rowCount, virtualizer]);

  const isEmpty = messages.length === 0;

  const renderRow = (index: number) => {
    if (index >= visibleMessages.length) {
      return (
        <MessageBubble speaker="assistant">
          <Box sx={{ display: 'flex', alignItems: 'center' }} data-testid="copilot-thinking">
            <Typography variant="body2" color="text.secondary">
              🤔 {t('copilot.thinking')}
            </Typography>
            <TypingDots aria-hidden="true" data-testid="copilot-typing-dots">
              <span />
              <span />
              <span />
            </TypingDots>
          </Box>
        </MessageBubble>
      );
    }

    const message = visibleMessages[index];
    if (!message) return null;

    if (message.role === 'user') {
      return (
        <MessageBubble speaker="user">
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {message.content}
          </Typography>
          {message.attachments && message.attachments.length > 0 && (
            <Typography variant="caption" sx={{ display: 'block', marginTop: 1 }}>
              {t('copilot.selectedCount', { count: message.attachments.length })}
            </Typography>
          )}
        </MessageBubble>
      );
    }

    return (
      <MessageBubble speaker="assistant">
        <AssistantMessage
          plan={message.plan || null}
          onAddToQueue={() => {
            if (message.plan) onAddToQueue(message.plan);
          }}
          busy={busy}
          error={message.error}
          notice={message.notice}
        />
      </MessageBubble>
    );
  };

  return (
    <ConversationScroll ref={scrollRef} $empty={isEmpty} data-testid="copilot-conversation" data-empty={isEmpty || undefined}>
      {isEmpty ? (
        <ConversationStream aria-live="polite">
          <Welcome />
        </ConversationStream>
      ) : (
        <VirtualConversationStream aria-live="polite" sx={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualRow) => (
            <VirtualRow
              key={virtualRow.key}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              data-testid="copilot-message-row"
              sx={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              {renderRow(virtualRow.index)}
            </VirtualRow>
          ))}
        </VirtualConversationStream>
      )}
    </ConversationScroll>
  );
}
