/**
 * @fileoverview Status badge primitive for the MCP App views.
 *
 * Used for job states, plan confidence, lab outcomes and workflow validity.
 */

import { ViewBadgeRoot } from './styles';

export type ViewBadgeTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info';

export interface ViewBadgeProps {
  /** Badge text. */
  children: string;
  /** Visual tone. Defaults to `neutral`. */
  tone?: ViewBadgeTone;
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

/**
 * Renders a small status pill.
 * @param {ViewBadgeProps} props - Component props.
 * @returns {JSX.Element} The badge.
 */
export default function ViewBadge({ children, tone = 'neutral', testId }: ViewBadgeProps) {
  return (
    <ViewBadgeRoot as="span" tone={tone} data-testid={testId}>
      {children}
    </ViewBadgeRoot>
  );
}
