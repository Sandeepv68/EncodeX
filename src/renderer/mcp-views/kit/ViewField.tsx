/**
 * @fileoverview Form-field primitive for the MCP App views.
 *
 * The convert view is the only view with inputs; it uses the app's outlined
 * input styling so it matches the conversion page.
 */

import { TextField } from '@mui/material';

export interface ViewFieldProps {
  /** Field label. */
  label: string;
  /** Current value. */
  value: string;
  /** Called with the next value whenever the user edits the field. */
  onChange: (value: string) => void;
  /** Input type; defaults to `text`. */
  type?: 'text' | 'number';
  /** Optional placeholder. */
  placeholder?: string;
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

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
