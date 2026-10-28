/**
 * @fileoverview Inline fact list for the MCP App views.
 *
 * Renders the "Duration / Size / Bitrate" style rows of the media-info and
 * inspector views as a wrapping inline list.
 */

import { Typography } from '@mui/material';
import { ViewFact, ViewFactsList as ViewFactsListRoot } from './styles';

export interface ViewFactItem {
  /** Fact name. */
  label: string;
  /** Fact value; rendered verbatim as text. */
  value: string;
}

export interface ViewFactsListProps {
  /** Facts to render, in order. */
  facts: ViewFactItem[];
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

/**
 * Renders the fact list.
 * @param {ViewFactsListProps} props - Component props.
 * @returns {JSX.Element} The fact list.
 */
export default function ViewFactsList({ facts, testId }: ViewFactsListProps) {
  return (
    <ViewFactsListRoot as="ul" data-testid={testId}>
      {facts.map((fact) => (
        <ViewFact as="li" key={`${fact.label}:${fact.value}`}>
          <Typography variant="caption" color="text.secondary">
            {fact.label}
          </Typography>
          <Typography variant="body2">{fact.value}</Typography>
        </ViewFact>
      ))}
    </ViewFactsListRoot>
  );
}
