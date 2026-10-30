import { styled } from '@mui/material/styles';
import { TextField } from '@mui/material';

/** Time input field whose value is rendered in a monospace font. */
export const TimeInputField = styled(TextField)({
  '& .MuiInputBase-input': {
    fontFamily: 'monospace',
  },
});
