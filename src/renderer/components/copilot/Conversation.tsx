/**
 * @fileoverview Conversation transcript: renders the message stream, the
 * "thinking" indicator and the empty-state welcome.
 */

import { useEffect, useRef } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { CopilotPlan } from '../../../shared/copilot';
import MessageBubble from './MessageBubble';
import AssistantMessage from './AssistantMessage';
import Welcome from './Welcome';
import { ConversationScroll, ConversationStream } from '../../styles/copilot/Conversation.styles';

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

/**
 * Renders the scrolling conversation transcript.
 * @param {ConversationProps} props - Component props.
 * @returns {JSX.Element} The transcript.
 */
export default function Conversation({ messages, isThinking = false, onAddToQueue, busy = false }: ConversationProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  return (
    <ConversationScroll ref={scrollRef} data-testid="copilot-conversation">
      <ConversationStream aria-live="polite">
        {messages.length === 0 && <Welcome />}
        {messages.map((message) => {
          if (message.role === 'user') {
            return (
              <MessageBubble key={message.id} speaker="user">
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {message.content}
                </Typography>
                {message.attachments && message.attachments.length > 0 && (
                  <Typography variant="caption" sx={{ display: 'block', marginTop: 1, opacity: 0.9 }}>
                    {t('copilot.selectedCount', { count: message.attachments.length })}
                  </Typography>
                )}
              </MessageBubble>
            );
          }
          if (!message.plan && !message.error && !message.notice) return null;
          return (
            <MessageBubble key={message.id} speaker="assistant">
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
        })}
        {isThinking && (
          <MessageBubble speaker="assistant">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="body2">{t('copilot.planning')}</Typography>
            </Box>
          </MessageBubble>
        )}
      </ConversationStream>
    </ConversationScroll>
  );
}
