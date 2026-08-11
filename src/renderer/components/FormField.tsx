/**
 * @fileoverview Shared labeled form field wrapper.
 *
 * Renders a field label (with an optional info {@link InfoTooltip}, required
 * marker, and `htmlFor` association) above a control supplied by the caller,
 * plus an optional helper/error line below it. The control id is generated with
 * `useId` when no explicit id is provided and handed to the caller through a
 * render prop so the real input can be wired up for label association and
 * screen readers.
 *
 * Required markers are rendered as a separate `aria-hidden` span so exact-text
 * queries like `getByText('Label')` keep matching the label alone.
 *
 * Props (see {@link FormFieldProps}):
 *  - label: field label text.
 *  - hint: optional tooltip text shown next to the label.
 *  - required: shows an accessible required marker after the label.
 *  - error: optional error message shown as an error helper line.
 *  - helperText: optional helper text shown below the control.
 *  - htmlFor: optional explicit control id (defaults to a generated one).
 *  - testId: optional test id on the wrapping box.
 *  - children: render-prop receiving the control id.
 */

import { useId } from 'react';
import { FormHelperText } from '@mui/material';
import InfoTooltip from './InfoTooltip';
import type { FormFieldProps } from './types';
import { FieldBox, FieldLabel, RequiredMarker } from '../styles/form.styles';

/**
 * Renders the labeled form field wrapper.
 *
 * @param {FormFieldProps} props - Component props.
 * @returns {JSX.Element} The label, control slot, and optional helper/error line.
 */
export default function FormField({ label, hint, required, error, helperText, htmlFor, testId, children }: FormFieldProps) {
  const generatedId = useId();
  const controlId = htmlFor ?? generatedId;
  const helperLine = error ?? helperText;
  return (
    <FieldBox data-testid={testId}>
      <FieldLabel htmlFor={controlId}>
        {label}
        {required && <RequiredMarker aria-hidden="true">*</RequiredMarker>}
        {hint && <InfoTooltip title={hint} />}
      </FieldLabel>
      {children(controlId)}
      {helperLine !== undefined && <FormHelperText error={!!error}>{helperLine}</FormHelperText>}
    </FieldBox>
  );
}
