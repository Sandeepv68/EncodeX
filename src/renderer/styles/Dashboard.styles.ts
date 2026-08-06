import { styled, keyframes } from '@mui/material/styles';
import { Box, Card, CardActionArea, CardContent, Typography } from '@mui/material';
import { SHADOWS } from '../colors';

const fadeSlideUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
`;

const fadeInScale = keyframes`
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
`;

export const WelcomeTitle = styled(Typography)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  color: theme.palette.primary.main,
  fontWeight: 700,
  marginBottom: theme.spacing(1),
  animation: `${fadeSlideUp} 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards`,
  animationDelay: '0.05s',
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
  },
}));

export const WelcomeIcon = styled('img')(({ theme }) => ({
  width: theme.typography.pxToRem(128),
  height: theme.typography.pxToRem(128),
  marginBottom: theme.spacing(1),
  borderRadius: theme.typography.pxToRem(10),
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS.SOFT_DARK : SHADOWS.SOFT_LIGHT,
  userSelect: 'none',
  WebkitUserSelect: 'none',
  pointerEvents: 'none',
  animation: `${fadeInScale} 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards`,
  animationDelay: '0.1s',
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
  },
}));

export const DashboardSubtitle = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  textAlign: 'center',
  maxWidth: theme.typography.pxToRem(560),
  animation: `${fadeSlideUp} 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards`,
  animationDelay: '0.18s',
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
  },
}));

export const FeatureCard = styled(Card)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  backgroundColor: theme.palette.background.paper,
  border: `${theme.typography.pxToRem(1)} solid`,
  borderColor: theme.palette.divider,
  boxShadow: theme.palette.mode === 'dark' ? SHADOWS.SOFT_DARK : SHADOWS.SOFT_LIGHT,
  transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.2s',
  animation: `${fadeSlideUp} 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards`,
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
  },
  '&:hover': {
    borderColor: theme.palette.primary.main,
    transform: `translateY(${theme.typography.pxToRem(-2)})`,
    boxShadow: theme.palette.mode === 'dark' ? SHADOWS.SOFT_HOVER_DARK : SHADOWS.SOFT_HOVER_LIGHT,
  },
}));

export const CardLink = styled(CardActionArea)(({ theme }) => ({
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  flexGrow: 1,
}));

export const FeatureIconBox = styled(Box)(({ theme }) => ({
  fontSize: theme.typography.pxToRem(40),
  color: theme.palette.primary.main,
  marginBottom: theme.spacing(1),
  display: 'flex',
  justifyContent: 'flex-start',
}));

export const CardTitleText = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(0.5),
  textAlign: 'left',
}));

export const CardBody = styled(CardContent)({
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  flexGrow: 1,
});
