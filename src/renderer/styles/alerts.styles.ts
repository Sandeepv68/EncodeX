/**
 * @fileoverview Shared styling primitives for every alert surface.
 *
 * All alerts in the renderer derive from {@link BaseAlert} so they share one
 * visual language regardless of where they appear:
 *  - medium (500) text weight,
 *  - the same soft elevation used by cards and panels,
 *  - a full-width message slot that fills the space between the icon and the
 *    optional action,
 *  - the 10px corner radius applied to every MUI alert by the theme.
 *
 * Page-specific alerts (toolbar spacing, mux-queue truncation, Copilot
 * emphasis, toast sizing) extend the base and add only the properties they
 * genuinely need instead of re-declaring the core look.
 */

import { styled } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import { Alert } from '@mui/material';
import { SHADOWS } from '../../shared/theme/colors';

/**
 * Soft elevation shared by every alert so they read as one family.
 * @param {Theme} theme - The MUI theme selecting the light/dark variant.
 * @returns {string} The box-shadow for the current colour mode.
 */
export const alertShadow = (theme: Theme): string => (theme.palette.mode === 'dark' ? SHADOWS(theme).SOFT_DARK : SHADOWS(theme).SOFT_LIGHT);

/**
 * Base surface every alert derives from. Keeps the text weight, elevation and
 * message layout identical across inline alerts, toasts and banners.
 * @const BaseAlert
 */
export const BaseAlert = styled(Alert)(({ theme }) => ({
  fontWeight: 500,
  boxShadow: alertShadow(theme),
  '& .MuiAlert-message': {
    flex: '1 1 auto',
    minWidth: 0,
    fontWeight: 500,
  },
}));

/** Standard inline alert used for page-level notices and warnings. @const InlineAlert */
export const InlineAlert = BaseAlert;

/** Hardware-acceleration notice shown on the encoding pages. @const AccelAlert */
export const AccelAlert = InlineAlert;

/** Compatibility notice shown on the convert/remux pages. @const CompatAlert */
export const CompatAlert = InlineAlert;

/** Locked-options warning shown above the encoding options. @const LockedAlert */
export const LockedAlert = InlineAlert;

/**
 * Filled toast/snackbar alert: the same base surface, capped to a readable
 * width and forced to light text for the filled severity variants.
 * @const ToastAlert
 */
export const ToastAlert = styled(BaseAlert)(({ theme }) => ({
  maxWidth: theme.typography.pxToRem(600),
  color: theme.palette.common.white,
}));
