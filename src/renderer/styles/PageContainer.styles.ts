import { styled } from '@mui/material/styles';
import { Box, Typography, Paper } from '@mui/material';
import { SHADOWS } from '../colors';

export const PageRoot = styled(Box)<{ hasAside?: boolean }>(({ theme, hasAside }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: theme.spacing(2),
  ...(hasAside
    ? {
        [theme.breakpoints.up('md')]: {
          flexDirection: 'row',
          alignItems: 'flex-start',
        },
      }
    : {}),
}));

export const PageBody = styled(Box)({ flex: 1, minWidth: 0 });

export const PageTitle = styled(Typography)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  fontWeight: 600,
  marginBottom: theme.spacing(2),
}));

export const TitleIcon = styled('span')({
  display: 'inline-flex',
  alignItems: 'center',
  lineHeight: 1,
  marginRight: 8,
});

export const ContentPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  [theme.breakpoints.up('sm')]: { padding: theme.spacing(3) },
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS.SOFT_DARK : SHADOWS.SOFT_LIGHT,
}));
