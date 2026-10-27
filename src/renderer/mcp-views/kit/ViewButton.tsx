/**
 * @fileoverview Button primitive for the MCP App views.
 *
 * The views use three button flavours: a primary action (start a conversion,
 * run an operation), a neutral action (cancel) and a destructive action
 * (cancel a job). Destructive actions are armed: the first click only arms the
 * button, the second one runs the action.
 */

import { Button } from '@mui/material';

export type ViewButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ViewButtonProps {
  /** Button label. */
  label: string;
  /** Called on every click; armed actions receive the second click only. */
  onClick: () => void;
  /** Visual variant. Defaults to `secondary`. */
  variant?: ViewButtonVariant;
  /** Label shown while the action is armed. */
  confirmLabel?: string;
  /** True while the action is armed. */
  armed?: boolean;
  /** Disables the button. */
  disabled?: boolean;
  /** Test hook for the host-rendering checks. */
  testId?: string;
}

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
