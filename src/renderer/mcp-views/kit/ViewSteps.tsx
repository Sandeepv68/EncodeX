/**
 * @fileoverview Step-list primitive for the MCP App views.
 *
 * The workflow view renders an ordered plan; the plan and lab views render
 * rationale lists. Both use the same numbered-row presentation.
 */

import { Typography } from '@mui/material';
import { ViewStepsIndex, ViewStepsItem, ViewStepsList } from './styles';

export interface ViewStep {
  /** Primary text of the step (the tool and its id). */
  primary: string;
  /** Optional secondary text (dependencies, status, output). */
  secondary?: string;
}

export interface ViewStepsProps {
  /** Steps to render, in order. */
  steps: ViewStep[];
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

/**
 * Renders a numbered step list.
 * @param {ViewStepsProps} props - Component props.
 * @returns {JSX.Element} The step list.
 */
export default function ViewSteps({ steps, testId }: ViewStepsProps) {
  return (
    <ViewStepsList as="ol" data-testid={testId}>
      {steps.map((step, index) => (
        <ViewStepsItem as="li" key={`${step.primary}:${index}`}>
          <ViewStepsIndex aria-hidden="true">{index + 1}</ViewStepsIndex>
          <Typography variant="body2" noWrap title={step.primary}>
            {step.primary}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {step.secondary ?? ''}
          </Typography>
        </ViewStepsItem>
      ))}
    </ViewStepsList>
  );
}
