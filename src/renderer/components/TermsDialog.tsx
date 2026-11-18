/**
 * @fileoverview Terms and Conditions dialog.
 *
 * Displays the full Terms & Conditions document in a modal dialog. The dialog
 * operates in two modes driven by {@link useTermsStore}:
 *  - accept: blocking startup gate; only Accept and Reject are actionable.
 *  - view: read-only with a header close button.
 */

import { useTranslation } from 'react-i18next';
import { Button } from '@mui/material';
import { faCheck, faFileContract, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import AppDialog from './AppDialog';
import { TERMS_VERSION, TERMS_SECTIONS } from '../../shared/terms';
import { useTermsStore } from '../stores/termsStore';
import { TermsContent, TermsDialogPaper, TermsSectionBody, TermsSectionTitle, TermsLastUpdated } from '../styles/TermsDialog.styles';

/**
 * Blocks dialog dismissal in accept mode.
 * @param {object} _event - Close event.
 * @param {string} _reason - Close reason.
 * @returns {undefined} Prevents closing.
 */
function handleBlockedClose(_event: object, _reason: 'backdropClick' | 'escapeKeyDown'): undefined {
  return undefined;
}

export default function TermsDialog() {
  const { t } = useTranslation();
  const { dialogOpen, mode, accept, rejectTerms, closeDialog } = useTermsStore();

  const isAcceptMode = mode === 'accept';

  return (
    <AppDialog
      open={dialogOpen}
      onClose={isAcceptMode ? handleBlockedClose : closeDialog}
      title={t('terms.title')}
      icon={<FontAwesomeIcon icon={faFileContract} />}
      showCloseButton={!isAcceptMode}
      closeButtonAriaLabel={t('terms.close')}
      closeButtonTestId="terms-close"
      paperTestId="terms-dialog"
      PaperComponent={TermsDialogPaper}
      actions={
        isAcceptMode ? (
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
        ) : null
      }
    >
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
        <TermsLastUpdated variant="body2">{t('terms.lastUpdated', { date: TERMS_VERSION })}</TermsLastUpdated>
      </TermsContent>
    </AppDialog>
  );
}
