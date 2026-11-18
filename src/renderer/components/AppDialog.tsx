import { useId, type ReactNode } from 'react';
import { Dialog, DialogActions, Divider } from '@mui/material';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { DialogProps } from '@mui/material/Dialog';
import {
  AppDialogBody,
  AppDialogCloseButton,
  AppDialogHeader,
  AppDialogIcon,
  AppDialogTitle,
  AppDialogTitleText,
} from '../styles/AppDialog.styles';

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

/**
 * Shared modal dialog with a standard header/body/footer layout.
 *
 * Header: leading icon (optional), title, trailing close button (optional).
 * Body: content area.
 * Footer: action buttons.
 * Sections are separated by horizontal dividers.
 * @param {AppDialogProps} props - Component props.
 * @returns {JSX.Element} The dialog.
 */
export default function AppDialog({
  open,
  onClose,
  onCloseButton,
  title,
  icon,
  children,
  actions,
  maxWidth,
  fullWidth,
  showCloseButton = false,
  closeButtonAriaLabel,
  closeButtonTestId,
  closeButtonDisabled = false,
  paperTestId,
  ariaLabelledBy,
  ariaDescribedBy,
  scroll = 'paper',
  disableContentPadding = false,
  contentDividers = true,
  PaperComponent,
  slotProps,
}: AppDialogProps) {
  const generatedId = useId();
  const titleId = ariaLabelledBy ?? `${generatedId}-title`;

  const mergedSlotProps = {
    ...slotProps,
    paper: {
      ...(slotProps?.paper ?? {}),
      ...(paperTestId ? { 'data-testid': paperTestId } : {}),
    },
  } as DialogProps['slotProps'];

  const handleCloseButton = () => {
    if (onCloseButton) {
      onCloseButton();
      return;
    }
    if (onClose) onClose({} as any, 'escapeKeyDown');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      scroll={scroll}
      aria-labelledby={titleId}
      aria-describedby={ariaDescribedBy}
      PaperComponent={PaperComponent}
      slotProps={mergedSlotProps}
    >
      <AppDialogTitle id={titleId}>
        <AppDialogHeader>
          {icon ? <AppDialogIcon>{icon}</AppDialogIcon> : null}
          <AppDialogTitleText component="span" variant="h6">
            {title}
          </AppDialogTitleText>
          {showCloseButton ? (
            <AppDialogCloseButton
              aria-label={closeButtonAriaLabel ?? 'Close'}
              onClick={handleCloseButton}
              data-testid={closeButtonTestId}
              disabled={closeButtonDisabled}
              edge="end"
              size="small"
            >
              <FontAwesomeIcon icon={faXmark} />
            </AppDialogCloseButton>
          ) : null}
        </AppDialogHeader>
      </AppDialogTitle>
      {contentDividers ? <Divider /> : null}
      <AppDialogBody dividers={false} $disablePadding={disableContentPadding}>
        {children}
      </AppDialogBody>
      {actions !== undefined ? (
        <>
          {contentDividers ? <Divider /> : null}
          <DialogActions>{actions}</DialogActions>
        </>
      ) : null}
    </Dialog>
  );
}
