import { styled } from '@mui/material/styles';
import type { ElementType } from 'react';
import { Box } from '@mui/material';
import { OptionIcon } from './ProfileSelector.styles';

/** Option icon tinted with the resolved brand color. */
export const ColoredOptionIcon = styled(OptionIcon, {
  shouldForwardProp: (prop) => prop !== '$color',
})<{ $color: string }>(({ $color }) => ({
  color: $color,
}));

/** Wrapper for the profile icon shown inside the active-profile chip. */
export const ChipIconBox = styled(Box)<{ component?: ElementType }>(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'stretch',
  fontSize: theme.typography.pxToRem(30),
  lineHeight: 1,
}));

/** Chip icon wrapper tinted with the resolved brand color. */
export const ColoredChipIconBox = styled(ChipIconBox, {
  shouldForwardProp: (prop) => prop !== '$color',
})<{ $color: string; component?: ElementType }>(({ $color }) => ({
  color: $color,
}));
