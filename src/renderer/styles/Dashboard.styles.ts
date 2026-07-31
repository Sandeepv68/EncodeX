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
  transition: 'border-color 0.2s, transform 0.2s',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    transform: `translateY(${theme.typography.pxToRem(-2)})`,
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
