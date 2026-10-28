/**
 * @fileoverview Label/value list primitive for the MCP App views.
 *
 * Renders the `details` rows of a confirmation proposal, the paths of a job and
 * the summary rows of the plan and lab views.
 */

import { ViewDefinitionGrid, ViewDefinitionLabel, ViewDefinitionValue } from './styles';

export interface ViewDefinitionRow {
  /** Row label. */
  label: string;
  /** Row value; rendered verbatim as text. */
  value: string;
}

export interface ViewDefinitionListProps {
  /** Rows to render, in order. */
  rows: ViewDefinitionRow[];
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

/**
 * Renders a two-column definition list.
 * @param {ViewDefinitionListProps} props - Component props.
 * @returns {JSX.Element} The definition list.
 */
export default function ViewDefinitionList({ rows, testId }: ViewDefinitionListProps) {
  return (
    <ViewDefinitionGrid data-testid={testId}>
      {rows.map((row) => (
        <ViewDefinitionListRow key={`${row.label}:${row.value}`} row={row} />
      ))}
    </ViewDefinitionGrid>
  );
}

/**
 * Renders one label/value pair.
 * @param {object} props - Component props.
 * @param {ViewDefinitionRow} props.row - The row to render.
 * @returns {JSX.Element} The row.
 */
function ViewDefinitionListRow({ row }: { row: ViewDefinitionRow }) {
  return (
    <>
      <ViewDefinitionLabel variant="body2">{row.label}</ViewDefinitionLabel>
      <ViewDefinitionValue variant="body2" title={row.value}>
        {row.value}
      </ViewDefinitionValue>
    </>
  );
}
