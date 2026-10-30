/**
 * @fileoverview Form-field primitive for the MCP App views.
 *
 * The convert view is the only view with inputs; it uses the app's outlined
 * input styling so it matches the conversion page.
 */

import { TextField } from '@mui/material';
import type { ViewFieldProps } from './types';

export type { ViewFieldProps };

/**
 * Renders a labelled text field.
 * @param {ViewFieldProps} props - Component props.
 * @returns {JSX.Element} The field.
 */
export default function ViewField({ label, value, onChange, type = 'text', placeholder, testId }: ViewFieldProps) {
  return (
    <TextField
      label={label}
      value={value}
      type={type}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      size="small"
      fullWidth
      slotProps={{ htmlInput: { 'data-testid': testId } }}
    />
  );
}
