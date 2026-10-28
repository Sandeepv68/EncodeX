/**
 * @fileoverview Card primitive for the MCP App views.
 *
 * A view is a stack of cards; each card owns an optional title and an optional
 * action slot (buttons, badges). The card borrows the app's surface colours,
 * border and radius so a view embedded in the Copilot transcript reads as part
 * of the app.
 */

import type { ReactNode } from 'react';
import { ViewCardHeader, ViewCardRoot, ViewCardTitle } from './styles';

export interface ViewCardProps {
  /** Card heading. Rendered as a truncated single line. */
  title?: ReactNode;
  /** Controls rendered on the trailing edge of the header. */
  actions?: ReactNode;
  /** Card body. */
  children: ReactNode;
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

/**
 * Renders a titled card.
 * @param {ViewCardProps} props - Component props.
 * @returns {JSX.Element} The card.
 */
export default function ViewCard({ title, actions, children, testId }: ViewCardProps) {
  return (
    <ViewCardRoot data-testid={testId}>
      {(title !== undefined || actions !== undefined) && (
        <ViewCardHeader>
          {title !== undefined && <ViewCardTitle variant="body1">{title}</ViewCardTitle>}
          {actions}
        </ViewCardHeader>
      )}
      {children}
    </ViewCardRoot>
  );
}
