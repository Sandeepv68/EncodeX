import { Box, Button, Stack, TextField, Typography } from '@mui/material';

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
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <TextField
          fullWidth
          size="small"
          error={!!error}
          helperText={helperText}
          value={value}
          placeholder={placeholder}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          onBlur={onBlur}
          slotProps={onChange ? undefined : { input: { readOnly: true } }}
          sx={{ minWidth: 200, flex: 1 }}
        />
        <Button variant="outlined" onClick={onBrowse}>
          {buttonLabel}
        </Button>
      </Stack>
    </Box>
  );
}
