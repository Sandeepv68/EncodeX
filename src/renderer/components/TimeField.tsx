import { TextField } from '@mui/material';
import InfoTooltip from './InfoTooltip';
import type { TimeFieldProps } from './types';
import { FieldBox, FieldLabel } from '../styles/TimeField.styles';

export default function TimeField({ label, value, placeholder, error, hint, onChange, onBlur }: TimeFieldProps) {
  return (
    <FieldBox>
      <FieldLabel variant="caption" color="text.secondary">
        {label}
        {hint && <InfoTooltip title={hint} />}
      </FieldLabel>
      <TextField
        fullWidth
        size="small"
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
