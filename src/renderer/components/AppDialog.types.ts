import type { ReactNode } from 'react';
import type { DialogProps } from '@mui/material/Dialog';

/**
 * Props for the shared application dialog shell.
 * @interface AppDialogProps
 */
export interface AppDialogProps {
  open: boolean;
  onClose?: DialogProps['onClose'];
  onCloseButton?: () => void;
  title: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  maxWidth?: DialogProps['maxWidth'];
  fullWidth?: boolean;
  showCloseButton?: boolean;
  closeButtonAriaLabel?: string;
  closeButtonTestId?: string;
  closeButtonDisabled?: boolean;
  paperTestId?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  scroll?: DialogProps['scroll'];
  disableContentPadding?: boolean;
  contentDividers?: boolean;
  PaperComponent?: DialogProps['PaperComponent'];
  slotProps?: DialogProps['slotProps'];
}
