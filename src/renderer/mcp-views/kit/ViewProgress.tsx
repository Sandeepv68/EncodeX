/**
 * @fileoverview Progress track primitive for the MCP App views.
 *
 * The job, queue, batch and workflow views all show a completion percentage.
 */

import { ViewProgressTrack } from './styles';
import { clampPercent } from '../format';

export interface ViewProgressProps {
  /** Completion percentage; clamped to 0-100. */
  percent: number;
  /** Accessible label for the track. */
  label: string;
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

/**
 * Renders a determinate progress track.
 * @param {ViewProgressProps} props - Component props.
 * @returns {JSX.Element} The progress track.
 */
export default function ViewProgress({ percent, label, testId }: ViewProgressProps) {
  return <ViewProgressTrack variant="determinate" value={clampPercent(percent)} aria-label={label} data-testid={testId} />;
}
