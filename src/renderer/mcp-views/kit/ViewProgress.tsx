/**
 * @fileoverview Progress track primitive for the MCP App views.
 *
 * The job, queue, batch and workflow views all show a completion percentage.
 */

import { ViewProgressTrack } from './styles';
import { clampPercent } from '../format';
import type { ViewProgressProps } from './types';

export type { ViewProgressProps };

/**
 * Renders a determinate progress track.
 * @param {ViewProgressProps} props - Component props.
 * @returns {JSX.Element} The progress track.
 */
export default function ViewProgress({ percent, label, testId }: ViewProgressProps) {
  return <ViewProgressTrack variant="determinate" value={clampPercent(percent)} aria-label={label} data-testid={testId} />;
}
