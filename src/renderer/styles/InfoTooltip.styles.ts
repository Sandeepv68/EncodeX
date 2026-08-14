import { styled } from '@mui/material/styles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export const InfoIconWrapper = styled('span')(({ theme }) => ({
  display: 'inline-flex',
  cursor: 'help',
  marginInlineStart: theme.spacing(0.5),
  verticalAlign: 'middle',
  borderRadius: '50%',
  '&:focus-visible': {
    outline: `${theme.typography.pxToRem(2)} solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

export const InfoIcon = styled(FontAwesomeIcon)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(14),
}));
