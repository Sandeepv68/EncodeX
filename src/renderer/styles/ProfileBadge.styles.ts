import { styled } from '@mui/material/styles';
import { Chip, Typography } from '@mui/material';

/** Profile name shown inside the active-profile chip. */
export const BadgeName = styled(Typography)({
  fontWeight: 600,
  lineHeight: 1.3,
});

/** Profile description shown inside the active-profile chip. */
export const BadgeDescription = styled(Typography)(({ theme }) => ({
  lineHeight: 1.3,
  color: theme.palette.text.secondary,
}));

/** Chip that replaces the profile selector while a profile is active. */
export const ProfileChip = styled(Chip)(({ theme }) => ({
  height: 'auto',
  position: 'relative',
  paddingTop: theme.spacing(1),
  paddingBottom: theme.spacing(1),
  paddingLeft: theme.spacing(0.75),
  paddingRight: theme.spacing(2.25),
  '& .MuiChip-icon': {
    display: 'flex',
    alignItems: 'center',
    alignSelf: 'stretch',
    margin: 0,
  },
  '& .MuiChip-label': {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
    paddingTop: theme.spacing(0.5),
    paddingBottom: theme.spacing(0.5),
  },
  '& .MuiChip-deleteIcon': {
    position: 'absolute',
    top: 0,
    right: 0,
    color: theme.palette.error.main,
    fontSize: theme.typography.pxToRem(13),
    margin: 0,
    padding: theme.spacing(0.75),
    '&:hover': { color: theme.palette.error.main },
    '& svg': {
      display: 'block',
    },
  },
}));
