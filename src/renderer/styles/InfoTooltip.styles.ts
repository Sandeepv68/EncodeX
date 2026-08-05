import { styled } from '@mui/material/styles';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export const InfoIconWrapper = styled('span')(({ theme }) => ({
  display: 'inline-flex',
  cursor: 'help',
  marginLeft: theme.spacing(0.5),
  verticalAlign: 'middle',
}));

export const InfoIcon = styled(FontAwesomeIcon)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(14),
}));
