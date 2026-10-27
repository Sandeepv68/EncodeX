/**
 * @fileoverview Finding primitive for the MCP App views.
 *
 * The inspector view reports findings by severity; each one is rendered as a
 * card with a coloured rail and an uppercase severity tag.
 */

import { Typography } from '@mui/material';
import { ViewFindingRoot, ViewFindingTag } from './styles';

export type ViewFindingSeverity = 'info' | 'warning' | 'error';

export interface ViewFindingProps {
  /** Severity of the finding. */
  severity: ViewFindingSeverity;
  /** Human-readable severity name shown as the tag. */
  severityLabel: string;
  /** The finding text. */
  message: string;
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

/**
 * Renders a single finding.
 * @param {ViewFindingProps} props - Component props.
 * @returns {JSX.Element} The finding.
 */
export default function ViewFinding({ severity, severityLabel, message, testId }: ViewFindingProps) {
  return (
    <ViewFindingRoot severity={severity} data-testid={testId}>
      <ViewFindingTag variant="caption">{severityLabel}</ViewFindingTag>
      <Typography variant="body2">{message}</Typography>
    </ViewFindingRoot>
  );
}
