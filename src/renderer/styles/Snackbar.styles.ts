/**
 * @fileoverview Shared styles for the app's snackbars.
 */

import { styled } from '@mui/material/styles';
import { Snackbar } from '@mui/material';
import { TITLE_BAR_HEIGHT } from '../../shared/constants';

/**
 * Snackbar anchored below the custom title bar.
 *
 * MUI's own top-anchored snackbar sits 8px from the viewport top, which puts
 * it underneath the draggable title bar. The `&&` selector doubles the
 * generated class so this offset wins over MUI's `top` rule (and its
 * `sm`-breakpoint variant) without relying on inline styles.
 * @const TitleBarOffsetSnackbar
 */
export const TitleBarOffsetSnackbar = styled(Snackbar)(({ theme }) => ({
  '&&': {
    top: `calc(${theme.typography.pxToRem(TITLE_BAR_HEIGHT)} + ${theme.spacing(1)})`,
  },
}));
