/**
 * @fileoverview Conversation transcript: renders the virtualized message
 * stream, the "thinking" indicator and the empty-state welcome.
 */

import { useEffect, useMemo, useRef } from 'react';
import { Typography, useTheme } from '@mui/material';
import { measureElement as measureElementDefault, observeElementRect, useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import type { ConversationMessage, ConversationProps } from './types';
import MessageBubble from './MessageBubble';
import AssistantMessage from './AssistantMessage';
import Welcome from './Welcome';
import {
  AttachmentCountText,
  ConversationScroll,
  ConversationStream,
  ThinkingRow,
  TypingDots,
  UserMessageText,
  VirtualConversationStream,
  VirtualRow,
} from '../../styles/copilot/Conversation.styles';

export type { ConversationMessage };

const FALLBACK_VIEWPORT_HEIGHT = 640;
const THINKING_ROW_ESTIMATE = 72;
const USER_ROW_ESTIMATE = 88;
/** Rows are measured, so the estimate only has to be close enough. */
const ASSISTANT_ROW_ESTIMATE = 420;

/**
 * Renders the scrolling conversation transcript.
 * @param {ConversationProps} props - Component props.
 * @returns {JSX.Element} The transcript.
 */
export default function Conversation({ messages, isThinking = false, onAddToQueue, busy = false, providerId = null }: ConversationProps) {
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
          <ThinkingRow data-testid="copilot-thinking">
            <Typography variant="body2" color="text.secondary">
              🤔 {t('copilot.thinking')}
            </Typography>
            <TypingDots aria-hidden="true" data-testid="copilot-typing-dots">
              <span />
              <span />
              <span />
            </TypingDots>
          </ThinkingRow>
        </MessageBubble>
      );
    }

    const message = visibleMessages[index];
    if (!message) return null;

    if (message.role === 'user') {
      return (
        <MessageBubble speaker="user">
          <UserMessageText variant="body1">{message.content}</UserMessageText>
          {message.attachments && message.attachments.length > 0 && (
            <AttachmentCountText variant="caption">{t('copilot.selectedCount', { count: message.attachments.length })}</AttachmentCountText>
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
          providerId={providerId}
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
        <VirtualConversationStream aria-live="polite" $height={virtualizer.getTotalSize()}>
          {virtualizer.getVirtualItems().map((virtualRow) => (
            <VirtualRow
              key={virtualRow.key}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              data-testid="copilot-message-row"
              $offset={virtualRow.start}
            >
              {renderRow(virtualRow.index)}
            </VirtualRow>
          ))}
        </VirtualConversationStream>
      )}
    </ConversationScroll>
  );
}
