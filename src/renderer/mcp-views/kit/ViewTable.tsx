/**
 * @fileoverview Table primitive for the MCP App views.
 *
 * The media-info view lists streams, the lab view lists compression attempts.
 * Both are plain, sortable-free tables that must stay readable inside a narrow
 * iframe, so the container scrolls horizontally.
 */

import { Table, TableBody, TableHead, TableRow } from '@mui/material';
import { ViewTableScroll, ViewHeaderCell, ViewBodyCell } from './styles';
import type { ViewTableProps } from './types';

export type { ViewTableProps };

/**
 * Renders a data table.
 * @param {ViewTableProps} props - Component props.
 * @returns {JSX.Element} The table.
 */
export default function ViewTable({ columns, rows, testId }: ViewTableProps) {
  return (
    <ViewTableScroll data-testid={testId}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <ViewHeaderCell key={column}>{column}</ViewHeaderCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow key={`${rowIndex}:${row.join('|')}`}>
              {row.map((cell, cellIndex) => (
                <ViewBodyCell key={`${rowIndex}:${cellIndex}`}>{cell}</ViewBodyCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ViewTableScroll>
  );
}
