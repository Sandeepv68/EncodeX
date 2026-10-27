/**
 * @fileoverview Empty-state primitive for the MCP App views.
 *
 * Shown while the host has not delivered any data yet (the view is waiting for
 * the first `tool-result` notification) and when a list is legitimately empty.
 */

import { Typography } from '@mui/material';
import { ViewEmptyRoot } from './styles';

export interface ViewEmptyStateProps {
  /** Message describing what is being waited for. */
  message: string;
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

/**
 * Renders the placeholder.
 * @param {ViewEmptyStateProps} props - Component props.
 * @returns {JSX.Element} The placeholder.
 */
export default function ViewEmptyState({ message, testId }: ViewEmptyStateProps) {
  return (
    <ViewEmptyRoot data-testid={testId}>
      <Typography variant="body2">{message}</Typography>
    </ViewEmptyRoot>
  );
}
