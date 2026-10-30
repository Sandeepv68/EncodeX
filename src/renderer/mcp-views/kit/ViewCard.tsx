/**
 * @fileoverview Card primitive for the MCP App views.
 *
 * A view is a stack of cards; each card owns an optional title and an optional
 * action slot (buttons, badges). The card borrows the app's surface colours,
 * border and radius so a view embedded in the Copilot transcript reads as part
 * of the app.
 */

import { ViewCardHeader, ViewCardRoot, ViewCardTitle } from './styles';
import type { ViewCardProps } from './types';

export type { ViewCardProps };

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
