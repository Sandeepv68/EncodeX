import { styled } from '@mui/material/styles';
import { Box } from '@mui/material';
import { SHADOWS } from '../../shared/theme/colors';
import { ConnectionDot, RightActions } from './copilot/ChatComposer.styles';

/** Status pill wrapper with an optional soft drop shadow. @const StatusPill */
export const StatusPill = styled(RightActions, {
  shouldForwardProp: (prop) => prop !== '$elevated',
})<{ $elevated?: boolean }>(({ theme, $elevated }) => ({
  boxShadow: $elevated ? (theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT) : undefined,
}));

/** Round badge holding the provider logo. @const ProviderBadge */
export const ProviderBadge = styled(Box)(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: theme.typography.pxToRem(22),
  height: theme.typography.pxToRem(22),
  borderRadius: '50%',
  backgroundColor: theme.palette.background.paper,
  border: `${theme.typography.pxToRem(1)} solid`,
  borderColor: theme.palette.divider,
  flexShrink: 0,
}));

/** Provider logo image shown inside the badge. @const ProviderLogo */
export const ProviderLogo = styled('img')(({ theme }) => ({
  width: theme.typography.pxToRem(14),
  height: theme.typography.pxToRem(14),
}));

/** Fallback robot icon shown when no provider logo is available. @const ProviderIconFallback */
export const ProviderIconFallback = styled('span')(({ theme }) => ({
  display: 'inline-flex',
  fontSize: theme.typography.pxToRem(12),
}));

/** Status dot pinned to the corner of the provider badge. @const StatusDot */
export const StatusDot = styled(ConnectionDot)(({ theme }) => ({
  position: 'absolute',
  bottom: theme.typography.pxToRem(-1),
  right: theme.typography.pxToRem(-1),
}));

/** Caption naming the connected provider (or the disconnected state). @const StatusCaption */
export const StatusCaption = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$expanded',
})<{ $expanded?: boolean }>(({ theme, $expanded }) => ({
  maxWidth: $expanded ? theme.typography.pxToRem(420) : 0,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  opacity: $expanded ? 1 : 0,
  marginInlineStart: $expanded ? theme.spacing(0.75) : 0,
  transition: theme.transitions.create(['max-width', 'opacity'], {
    duration: theme.transitions.duration.short,
  }),
}));
