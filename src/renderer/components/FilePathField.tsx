/**
 * @fileoverview Labeled file path input with a browse button.
 *
 * Renders a field label (optionally followed by an info {@link InfoTooltip} for
 * a hint), a read-only or editable text field holding a file path, and a
 * browse button that fires `onBrowse` so the parent can open a file dialog.
 *
 * When an `onChange` handler is provided the field is editable and uses a blank
 * helper text line to reserve vertical space; otherwise it is read-only and
 * displays the `error` string (if any) as helper text. Used across pages that
 * require a source file path.
 *
 * Props (see {@link FilePathFieldProps}):
 *  - label: caption text describing the field.
 *  - value: current path shown in the input.
 *  - placeholder: placeholder text for the input.
 *  - buttonLabel: text of the browse button.
 *  - onBrowse: callback for the browse button.
 *  - onChange: optional callback making the field editable.
 *  - onBlur: optional blur callback.
 *  - error: optional error text shown as helper text.
 *  - hint: optional text shown in an info tooltip next to the label.
 */

import { faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import FormField from './FormField';
import type { FilePathFieldProps } from './types';
import { FieldStack, PathField, BrowseButton } from '../styles/FilePathField.styles';

/**
 * Renders the labeled file path input with a browse button.
 *
 * Composes a {@link FormField} (caption label with an {@link InfoTooltip} when
 * a `hint` is given), a {@link PathField} input, and a browse {@link BrowseButton}.
 * The input is read-only when no `onChange` is supplied, in which case the
 * `error` string becomes the helper text; when editable, a single space is used
 * as helper text so the layout does not shift when errors later appear.
 *
 * @param {FilePathFieldProps} props - Component props.
 * @param {string} props.label - Caption text describing the field.
 * @param {string} props.value - Current path value displayed in the input.
 * @param {string} props.placeholder - Placeholder shown when the field is empty.
 * @param {string} props.buttonLabel - Label of the browse button.
 * @param {() => void} props.onBrowse - Callback invoked when the browse button
 *   is clicked.
 * @param {(value: string) => void} [props.onChange] - When present, makes the
 *   field editable and receives each new value.
 * @param {() => void} [props.onBlur] - Optional callback fired on blur.
 * @param {string} [props.error] - Optional error text shown as helper text.
 * @param {string} [props.hint] - Optional hint text shown in an info tooltip.
 * @returns {JSX.Element} The label, input row, and browse button.
 */
export default function FilePathField({
  label,
  value,
  placeholder,
  buttonLabel,
  onBrowse,
  onChange,
  onBlur,
  error,
  hint,
  required,
  testId,
}: FilePathFieldProps) {
  const helperText = error ? error : onChange ? ' ' : undefined;
  return (
    <FormField label={label} hint={hint} required={required} error={error} helperText={helperText} testId={testId}>
      {(id) => (
        <FieldStack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap>
          <PathField
            id={id}
            fullWidth
            size="small"
            data-testid={testId}
            error={!!error}
            value={value}
            placeholder={placeholder}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            onBlur={onBlur}
            slotProps={{
              input: onChange ? undefined : { readOnly: true },
              htmlInput: required ? { 'aria-required': 'true' } : undefined,
            }}
          />
          <BrowseButton variant="outlined" startIcon={<FontAwesomeIcon icon={faFolderOpen} />} onClick={onBrowse}>
            {buttonLabel}
          </BrowseButton>
        </FieldStack>
      )}
    </FormField>
  );
}
