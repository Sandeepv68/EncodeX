import { Box, Button } from '@mui/material';
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { FieldLabel, FieldStack, PathField } from '../styles/FilePathField.styles';

interface Props {
  label: string;
  value: string;
  placeholder: string;
  buttonLabel: string;
  onBrowse: () => void;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  error?: string;
}

export default function FilePathField({ label, value, placeholder, buttonLabel, onBrowse, onChange, onBlur, error }: Props) {
  const helperText = error ? error : onChange ? ' ' : undefined;
  return (
    <Box>
      <FieldLabel variant="caption" color="text.secondary">
        {label}
      </FieldLabel>
      <FieldStack direction="row" spacing={1} useFlexGap>
        <PathField
          fullWidth
          size="small"
          error={!!error}
          helperText={helperText}
          value={value}
          placeholder={placeholder}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          onBlur={onBlur}
          slotProps={onChange ? undefined : { input: { readOnly: true } }}
        />
        <Button variant="outlined" startIcon={<FontAwesomeIcon icon={faFolderOpen} />} onClick={onBrowse}>
          {buttonLabel}
        </Button>
      </FieldStack>
    </Box>
  );
}
