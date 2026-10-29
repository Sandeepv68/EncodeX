/**
 * @fileoverview Chat message bubble for the Copilot conversation UI.
 */

import { Bubble, BubbleRow } from '../../styles/copilot/MessageBubble.styles';
import type { MessageBubbleProps } from './types';

export type { MessageBubbleProps };

/**
 * Renders one message bubble, aligned by speaker.
 * @param {MessageBubbleProps} props - Component props.
 * @returns {JSX.Element} The bubble.
 */
export default function MessageBubble({ speaker, children }: MessageBubbleProps) {
  const isUser = speaker === 'user';

  return (
    <BubbleRow $isUser={isUser}>
      <Bubble $isUser={isUser}>{children}</Bubble>
    </BubbleRow>
  );
}
