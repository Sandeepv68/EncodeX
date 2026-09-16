/**
 * @fileoverview Terms and Conditions dialog.
 *
 * Displays the full Terms & Conditions document in a modal MUI Dialog. The
 * dialog operates in two modes driven by {@link useTermsStore}:
 *
 *  - **accept** (the startup gate): the dialog is blocking — Escape and backdrop
 *    clicks are disabled; only the Accept and Reject buttons are actionable.
 *    Accepting persists the current terms version and closes the dialog; rejecting
 *    asks the main process to quit the app.
 *  - **view** (the About page viewer): the dialog is read-only with only a Close
 *    button. No consent is mutated.
 *
 * Mounted globally in `AppLayout` alongside the other global dialogs
 * (`CloseConfirmDialog`, `UpdateDialog`); its open state is driven entirely
 * by the store, so no parent props are required.
 */

import { useTranslation } from 'react-i18next';
import { Button, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { TERMS_VERSION, TERMS_SECTIONS } from '../../shared/terms';
import { useTermsStore } from '../stores/termsStore';
import { TermsContent, TermsDialog as StyledTermsDialog, TermsSectionBody, TermsSectionTitle } from '../styles/TermsDialog.styles';

/**
 * Event handler: block dialog dismissal (Accept/Reject mode).
 * The dialog must not close via Escape or backdrop click when the user is
 * expected to make an explicit accept/reject decision; MUI v9 dropped the
 * `disableEscapeKeyDown` prop, so dismissal is suppressed by no-oping the
 * `onClose` callback regardless of the requested reason.
 * @param {object} _event - The close event (backdrop click or keydown).
 * @param {string} _reason - Why the close was requested
 *   ('backdropClick' | 'escapeKeyDown').
 * @returns {undefined} Prevents the dialog from closing.
 */
function handleBlockedClose(_event: object, _reason: 'backdropClick' | 'escapeKeyDown'): undefined {
  return undefined;
}

export default function TermsDialog() {
  const { t } = useTranslation();
  const { dialogOpen, mode, accept, rejectTerms, closeDialog } = useTermsStore();

  const isAcceptMode = mode === 'accept';

  return (
    <StyledTermsDialog
      open={dialogOpen}
      onClose={isAcceptMode ? handleBlockedClose : closeDialog}
      slotProps={{ paper: { 'data-testid': 'terms-dialog' } }}
    >
      <DialogTitle>{t('terms.title')}</DialogTitle>
      <DialogContent>
        <TermsContent>
          {TERMS_SECTIONS.map((section, i) => (
            <div key={i}>
              <TermsSectionTitle variant="h6">{section.title}</TermsSectionTitle>
              {section.body.map((paragraph, j) => (
                <TermsSectionBody key={j} variant="body2">
                  {paragraph}
                </TermsSectionBody>
              ))}
            </div>
          ))}
          <TermsSectionBody variant="body2" sx={{ mt: 1.5 }}>
            {t('terms.lastUpdated', { date: TERMS_VERSION })}
          </TermsSectionBody>
        </TermsContent>
      </DialogContent>
      <DialogActions>
        {isAcceptMode ? (
          <>
            <Button
              startIcon={<FontAwesomeIcon icon={faXmark} />}
              onClick={rejectTerms}
              color="error"
              variant="contained"
              data-testid="terms-reject"
            >
              {t('terms.reject')}
            </Button>
            <Button
              startIcon={<FontAwesomeIcon icon={faCheck} />}
              onClick={accept}
              color="primary"
              variant="contained"
              data-testid="terms-accept"
            >
              {t('terms.accept')}
            </Button>
          </>
        ) : (
          <Button onClick={closeDialog} data-testid="terms-close">
            {t('terms.close')}
          </Button>
        )}
      </DialogActions>
    </StyledTermsDialog>
  );
}
