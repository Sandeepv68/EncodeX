/**
 * @fileoverview Chat message bubble for the Copilot conversation UI.
 */

import type { ReactNode } from 'react';
import { Bubble, BubbleRow } from '../../styles/copilot/MessageBubble.styles';

export interface MessageBubbleProps {
  speaker: 'user' | 'assistant' | 'thought';
  children: ReactNode;
}

/**
 * Renders one message bubble, aligned by speaker.
 * @param {MessageBubbleProps} props - Component props.
 * @returns {JSX.Element} The bubble.
 */
export default function MessageBubble({ speaker, children }: MessageBubbleProps) {
  const isUser = speaker === 'user';

  return (
    <BubbleRow $isUser={isUser}>
      <Bubble elevation={isUser ? 1 : 0} $isUser={isUser}>
        {children}
      </Bubble>
    </BubbleRow>
  );
}
