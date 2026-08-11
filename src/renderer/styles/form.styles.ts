import { styled } from '@mui/material/styles';
import { Box, Paper, Typography } from '@mui/material';
import { SHADOWS } from '../colors';

/** Flex-growing wrapper for a single labeled form field. @const FieldBox */
export const FieldBox = styled(Box)({ flex: 1 });

/**
 * Standard field caption rendered as a real `<label>` so it can be associated
 * with its control via `htmlFor`. Styled with the theme's secondary text color
 * and a bold 12px caption look; a separate `aria-hidden` required marker can be
 * placed inside without breaking text queries.
 * @const FieldLabel
 */
export const FieldLabel = styled('label')(({ theme }) => ({
  display: 'block',
  marginBottom: theme.spacing(0.5),
  fontWeight: theme.typography.fontWeightBold,
  fontSize: theme.typography.pxToRem(12),
  lineHeight: 1.2,
  color: theme.palette.text.secondary,
}));

/** Accessible required-field marker (hidden from text queries). @const RequiredMarker */
export const RequiredMarker = styled('span')(({ theme }) => ({
  color: theme.palette.error.main,
  marginInlineStart: theme.spacing(0.25),
}));

/** Horizontal row that pairs a control with its caption/switch. @const ToggleRow */
export const ToggleRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  '& .MuiTypography-root.MuiTypography-caption': {
    fontWeight: theme.typography.fontWeightBold,
    color: theme.palette.text.secondary,
  },
}));

/** Card wrapper used to group related form sections. @const SectionCard */
export const SectionCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT,
}));

/** Bold section heading rendered inside a SectionCard. @const SectionTitle */
export const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
}));

/** Muted one-line description rendered under a SectionTitle. @const SectionHint */
export const SectionHint = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: theme.typography.pxToRem(13),
}));
