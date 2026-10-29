/**
 * @fileoverview Inline fact list for the MCP App views.
 *
 * Renders the "Duration / Size / Bitrate" style rows of the media-info and
 * inspector views as a wrapping inline list.
 */

import { Typography } from '@mui/material';
import { ViewFact, ViewFactsList as ViewFactsListRoot } from './styles';
import type { ViewFactItem, ViewFactsListProps } from './types';

export type { ViewFactItem, ViewFactsListProps };

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
