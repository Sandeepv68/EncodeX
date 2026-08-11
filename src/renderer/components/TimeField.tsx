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
 *  - formatHint: optional helper caption describing the expected format.
 *  - onChange: called with the raw input string on every keystroke.
 *  - onBlur: optional blur handler for validation.
 */

import { TextField, InputAdornment } from '@mui/material';
import { faClock } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import FormField from './FormField';
import type { TimeFieldProps } from './types';

/**
 * Renders a labeled time input field.
 *
 * Composes a {@link FormField} (label with an InfoTooltip when a hint is
 * present) above a full-width MUI TextField. The field is marked in error state
 * and shows `error` as helper text; otherwise the helper text line shows the
 * optional `formatHint` (or stays blank to reserve vertical space). Every
 * change is forwarded verbatim via onChange.
 * @param {TimeFieldProps} props - Component props.
 * @param {string} props.label - Label text shown above the field.
 * @param {string} props.value - Current input value.
 * @param {string} [props.placeholder] - Placeholder text for the field.
 * @param {string} [props.error] - Error message that puts the field in error
 *   state.
 * @param {string} [props.hint] - Tooltip text shown beside the label.
 * @param {string} [props.formatHint] - Helper caption describing the expected
 *   input format (e.g. "HH:MM:SS").
 * @param {(value: string) => void} props.onChange - Called with the raw input
 *   on every change.
 * @param {() => void} [props.onBlur] - Optional blur handler.
 * @returns {JSX.Element} The labeled time input field.
 */
export default function TimeField({
  label,
  value,
  placeholder,
  error,
  hint,
  formatHint,
  required,
  testId,
  onChange,
  onBlur,
}: TimeFieldProps) {
  return (
    <FormField label={label} hint={hint} required={required} error={error} helperText={formatHint ?? ' '} testId={testId}>
      {(id) => (
        <TextField
          id={id}
          fullWidth
          size="small"
          data-testid={testId}
          error={!!error}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          slotProps={{
            htmlInput: { sx: { fontFamily: 'monospace' }, ...(required ? { 'aria-required': 'true' } : {}) },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <FontAwesomeIcon icon={faClock} fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      )}
    </FormField>
  );
}
