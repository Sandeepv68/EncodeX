/**
 * @fileoverview Finding primitive for the MCP App views.
 *
 * The inspector view reports findings by severity; each one is rendered as a
 * card with a coloured rail and an uppercase severity tag.
 */

import { Typography } from '@mui/material';
import { ViewFindingRoot, ViewFindingTag } from './styles';
import type { ViewFindingProps, ViewFindingSeverity } from './types';

export type { ViewFindingProps, ViewFindingSeverity };

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
