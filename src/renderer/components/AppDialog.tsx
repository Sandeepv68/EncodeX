import { useId } from 'react';
import { Dialog, DialogActions, Divider } from '@mui/material';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { AppDialogProps } from './AppDialog.types';
import {
  AppDialogBody,
  AppDialogCloseButton,
  AppDialogHeader,
  AppDialogIcon,
  AppDialogTitle,
  AppDialogTitleText,
} from '../styles/AppDialog.styles';

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
  };

  const handleHeaderClose = () => {
    if (onCloseButton) {
      onCloseButton();
      return;
    }
    onClose?.({}, 'escapeKeyDown');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      scroll={scroll}
      PaperComponent={PaperComponent}
      aria-labelledby={titleId}
      aria-describedby={ariaDescribedBy}
      slotProps={mergedSlotProps}
    >
      <AppDialogHeader>
        <AppDialogTitle id={titleId}>
          {icon ? <AppDialogIcon>{icon}</AppDialogIcon> : null}
          <AppDialogTitleText variant="h6" component="span">
            {title}
          </AppDialogTitleText>
        </AppDialogTitle>
        {showCloseButton ? (
          <AppDialogCloseButton
            aria-label={closeButtonAriaLabel ?? 'Close'}
            data-testid={closeButtonTestId}
            disabled={closeButtonDisabled}
            onClick={handleHeaderClose}
          >
            <FontAwesomeIcon icon={faXmark} />
          </AppDialogCloseButton>
        ) : null}
      </AppDialogHeader>

      <Divider />

      <AppDialogBody $disablePadding={disableContentPadding} dividers={contentDividers}>
        {children}
      </AppDialogBody>

      {actions !== undefined ? (
        <>
          <Divider />
          <DialogActions>{actions}</DialogActions>
        </>
      ) : null}
    </Dialog>
  );
}
