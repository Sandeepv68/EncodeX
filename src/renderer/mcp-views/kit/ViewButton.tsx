/**
 * @fileoverview Button primitive for the MCP App views.
 *
 * The views use three button flavours: a primary action (start a conversion,
 * run an operation), a neutral action (cancel) and a destructive action
 * (cancel a job). Destructive actions are armed: the first click only arms the
 * button, the second one runs the action.
 */

import { Button } from '@mui/material';
import type { ViewButtonProps, ViewButtonVariant } from './types';

export type { ViewButtonProps, ViewButtonVariant };

/**
 * Renders a view button.
 * @param {ViewButtonProps} props - Component props.
 * @returns {JSX.Element} The button.
 */
export default function ViewButton({
  label,
  onClick,
  variant = 'secondary',
  confirmLabel,
  armed = false,
  disabled = false,
  testId,
}: ViewButtonProps) {
  const color = variant === 'primary' ? 'primary' : variant === 'danger' ? 'error' : 'secondary';
  return (
    <Button
      variant={variant === 'primary' ? 'contained' : variant === 'danger' ? 'contained' : 'outlined'}
      color={color}
      onClick={onClick}
      disabled={disabled}
      size="small"
      data-armed={armed ? '1' : undefined}
      data-testid={testId}
    >
      {armed && confirmLabel ? confirmLabel : label}
    </Button>
  );
}
