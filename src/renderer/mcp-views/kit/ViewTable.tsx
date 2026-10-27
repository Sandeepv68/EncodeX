/**
 * @fileoverview Table primitive for the MCP App views.
 *
 * The media-info view lists streams, the lab view lists compression attempts.
 * Both are plain, sortable-free tables that must stay readable inside a narrow
 * iframe, so the container scrolls horizontally.
 */

import { Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { ViewTableScroll } from './styles';

export interface ViewTableProps {
  /** Column headers. */
  columns: string[];
  /** Rows; each cell is rendered as text. */
  rows: string[][];
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

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
              <TableCell key={column} sx={{ fontWeight: 500, color: 'text.secondary' }}>
                {column}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow key={`${rowIndex}:${row.join('|')}`}>
              {row.map((cell, cellIndex) => (
                <TableCell key={`${rowIndex}:${cellIndex}`} sx={{ whiteSpace: 'nowrap' }}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ViewTableScroll>
  );
}
