/**
 * @fileoverview Time input field.
 *
 * Renders a labeled, full-width MUI TextField for entering a time value. The
 * label is shown above the field and, when a hint is provided, is decorated
 * with an {@link InfoTooltip}. Error text replaces the helper text while an
 * error is set.
 *
 * Props (see {@link TimeFieldProps}):
 *  - label: field label text.
 *  - value: current field value.
 *  - placeholder: optional placeholder text.
 *  - error: optional error message that flags the field as invalid.
 *  - hint: optional tooltip text shown next to the label.
 *  - onChange: called with the raw input string on every keystroke.
 *  - onBlur: optional blur handler for validation.
 */

import { TextField } from '@mui/material';
import InfoTooltip from './InfoTooltip';
import type { TimeFieldProps } from './types';
import { FieldBox, FieldLabel } from '../styles/TimeField.styles';

/**
 * Renders a labeled time input field.
 *
 * Composes a FieldLabel (with an InfoTooltip when a hint is present) above a
 * full-width MUI TextField. The field is marked in error state and shows
 * `error` as helper text; otherwise the helper text reserves a line of space.
 * Every change is forwarded verbatim via onChange.
 * @param {TimeFieldProps} props - Component props.
 * @param {string} props.label - Label text shown above the field.
 * @param {string} props.value - Current input value.
 * @param {string} [props.placeholder] - Placeholder text for the field.
 * @param {string} [props.error] - Error message that puts the field in error
 *   state.
 * @param {string} [props.hint] - Tooltip text shown beside the label.
 * @param {(value: string) => void} props.onChange - Called with the raw input
 *   on every change.
 * @param {() => void} [props.onBlur] - Optional blur handler.
 * @returns {JSX.Element} The labeled time input field.
 */
export default function TimeField({ label, value, placeholder, error, hint, testId, onChange, onBlur }: TimeFieldProps) {
  return (
    <FieldBox>
      <FieldLabel variant="caption" color="text.secondary">
        {label}
        {hint && <InfoTooltip title={hint} />}
      </FieldLabel>
      <TextField
        fullWidth
        size="small"
        data-testid={testId}
        error={!!error}
        helperText={error || ' '}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </FieldBox>
  );
}
