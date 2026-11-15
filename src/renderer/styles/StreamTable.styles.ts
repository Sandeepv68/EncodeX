import { alpha, styled } from '@mui/material/styles';
import type { CSSObject, Theme } from '@mui/material/styles';
import { Table } from '@mui/material';

/**
 * @fileoverview Shared styling for the source-stream tables (Remux, Demux) and
 * the queue job detail tables.
 *
 * The table owns its frame so the border is one continuous rounded rectangle.
 * Borders are therefore collapsed onto the table's own edges (`separate`
 * border-spacing with the outer edges left to the table) and drawn per cell
 * only on the bottom and inline-end, which keeps every junction a single line
 * with no doubled or clipped strokes. A bold non-wrapping header, banded rows
 * and a distinct hover tone fill out the grid.
 *
 * {@link framedTableStyle} exposes those rules so the queue job detail tables
 * are drawn exactly like the Remux/Demux stream tables.
 */

/**
 * The per-cell rules of a framed table: a single bottom and inline-end border
 * per cell, so every junction stays one line.
 * @param {Theme} theme - The active MUI theme.
 * @returns {CSSObject} The cell style rules.
 */
export function framedTableCellStyle(theme: Theme): CSSObject {
  return {
    borderBottom: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
    borderInlineEnd: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
    verticalAlign: 'middle',
    '&:last-child': {
      borderInlineEnd: 'none',
    },
  };
}

/**
 * The shared frame, header, banding and hover rules of a framed data table.
 * @param {Theme} theme - The active MUI theme.
 * @returns {CSSObject} The table style rules.
 */
export function framedTableStyle(theme: Theme): CSSObject {
  return {
    borderCollapse: 'separate',
    borderSpacing: 0,
    border: `${theme.typography.pxToRem(1)} solid ${theme.palette.divider}`,
    borderRadius: theme.typography.pxToRem(8),
    // Clips the header fill and row banding to the table's rounded corners.
    overflow: 'hidden',
    '& .MuiTableCell-root': framedTableCellStyle(theme),
    '& .MuiTableCell-head': {
      fontWeight: 600,
      whiteSpace: 'nowrap',
      backgroundColor: alpha(theme.palette.text.secondary, 0.12),
    },
    '& .MuiTableBody-root .MuiTableRow-root:last-of-type .MuiTableCell-root': {
      borderBottom: 'none',
    },
    '& .MuiTableBody-root .MuiTableRow-root:nth-of-type(even)': {
      backgroundColor: alpha(theme.palette.primary.main, 0.04),
    },
    '& .MuiTableBody-root .MuiTableRow-root:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.1),
    },
  };
}

/** Grid table of source streams with a framed border on every cell and row. @const StreamTable */
export const StreamTable = styled(Table)(({ theme }) => framedTableStyle(theme));
