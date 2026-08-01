import { styled } from '@mui/material/styles';
import { Box, Card, CardActionArea, CardContent, Typography } from '@mui/material';

export const WelcomeTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.primary.main,
  fontWeight: 700,
  marginBottom: theme.spacing(1),
}));

export const DashboardSubtitle = styled(Typography)(({ theme }) => ({ marginBottom: theme.spacing(3) }));

export const FeatureCard = styled(Card)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `${theme.typography.pxToRem(1)} solid`,
  borderColor: theme.palette.divider,
  boxShadow:
    theme.palette.mode === 'dark'
      ? '0 1px 2px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.15)'
      : '0 1px 2px rgba(0, 0, 0, 0.04), 0 2px 10px rgba(0, 0, 0, 0.05)',
  transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.2s',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    transform: `translateY(${theme.typography.pxToRem(-2)})`,
    boxShadow:
      theme.palette.mode === 'dark'
        ? '0 2px 4px rgba(0, 0, 0, 0.25), 0 4px 14px rgba(0, 0, 0, 0.2)'
        : '0 2px 4px rgba(0, 0, 0, 0.05), 0 6px 18px rgba(0, 0, 0, 0.08)',
  },
}));

export const CardLink = styled(CardActionArea)(({ theme }) => ({ padding: theme.spacing(2) }));

export const FeatureIconBox = styled(Box)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(40),
  color: theme.palette.primary.main,
  marginBottom: theme.spacing(1),
  display: 'flex',
}));

export const CardTitleText = styled(Typography)(({ theme }) => ({ marginBottom: theme.spacing(0.5) }));

export const CardBody = styled(CardContent)({ padding: 0 });
