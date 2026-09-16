/**
 * @fileoverview Zustand store for the Terms & Conditions acceptance gate.
 *
 * Holds the version of the terms the user has consented to (persisted to
 * localStorage under 'encodex-terms-accepted') and drives the TermsDialog that
 * shows the agreement on first run and whenever the terms are updated.
 *
 * State held:
 *  - acceptedVersion: latest terms version the user accepted (or null)
 *  - acceptedAt: ISO timestamp of the acceptance
 *  - requiresAcceptance: true when the stored version differs from TERMS_VERSION
 *  - dialogOpen / mode: the dialog's visibility and its behaviour ('accept' for
 *    the startup gate, 'view' for the read-only About page viewer)
 *
 * The dialog starts open at store creation whenever acceptance is required, so
 * the gate renders in the AppLayout on the very first frames — no effect-based
 * prompt is used and React StrictMode double-mounting cannot double-prompt.
 *
 * Rejecting quits the app deterministically: `rejectTerms()` sends the
 * 'terms-reject' channel to the main process, which calls `app.quit()`
 * directly, bypassing the close-confirmation round-trip.
 *
 * Consumers:
 *  - TermsDialog (render + accept/reject/view actions)
 *  - About page (opens the dialog in view mode via openViewer)
 */

import { create } from 'zustand';
import { Logger } from '../../shared/logger';
import { TERMS_VERSION } from '../../shared/terms';
import { TERMS_ACCEPTED_STORAGE_KEY } from '../../shared/constants';

const STORAGE_KEY = TERMS_ACCEPTED_STORAGE_KEY;

const log = new Logger('renderer/stores/termsStore');

/**
 * A persisted acceptance record: which terms version was accepted and when.
 * @interface AcceptedTermsRecord
 * @property {string} version - The accepted TERMS_VERSION.
 * @property {string} acceptedAt - ISO timestamp of the acceptance.
 */
interface AcceptedTermsRecord {
  version: string;
  acceptedAt: string;
}

/**
 * Reads and validates the persisted acceptance record from localStorage.
 * Returns null when nothing is stored or the value is malformed; a record
 * whose version does not match the current TERMS_VERSION simply fails the
 * equality check in requiresAcceptance().
 * @returns {AcceptedTermsRecord | null} The stored record, or null.
 */
function loadAcceptedRecord(): AcceptedTermsRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as AcceptedTermsRecord).version !== 'string' ||
      typeof (parsed as AcceptedTermsRecord).acceptedAt !== 'string'
    ) {
      return null;
    }
    return { version: (parsed as AcceptedTermsRecord).version, acceptedAt: (parsed as AcceptedTermsRecord).acceptedAt };
  } catch {
    log.warn('Failed to load accepted terms record from localStorage');
    return null;
  }
}

/**
 * Persists an acceptance record to localStorage.
 * @param {AcceptedTermsRecord} record - The record to store.
 * @returns {void}
 */
function saveAcceptedRecord(record: AcceptedTermsRecord): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch (err) {
    log.warn('Failed to persist accepted terms record to localStorage', err);
  }
}

/**
 * Dialog behaviour modes: 'accept' is the blocking startup gate (Accept/Reject,
 * no dismissal); 'view' is the read-only About page viewer (Close only).
 * @type {'accept' | 'view'}
 */

/**
 * Terms gate store type.
 * @interface TermsState
 * @property {string | null} acceptedVersion - Version of the terms the user accepted.
 * @property {boolean} requiresAcceptance - True while the stored version !== TERMS_VERSION.
 * @property {boolean} dialogOpen - Whether the TermsDialog is visible.
 * @property {'accept' | 'view'} mode - Dialog behaviour mode.
 * @property {() => void} accept - Records acceptance of the current terms and closes the dialog.
 * @property {() => void} rejectTerms - Asks the main process to quit the app.
 * @property {() => void} openViewer - Opens the dialog in read-only view mode.
 * @property {() => void} closeDialog - Closes the dialog (view mode only).
 */
interface TermsState {
  acceptedVersion: string | null;
  acceptedAt: string | null;
  requiresAcceptance: boolean;
  dialogOpen: boolean;
  mode: 'accept' | 'view';
  accept: () => void;
  rejectTerms: () => void;
  openViewer: () => void;
  closeDialog: () => void;
}

const acceptedRecord = loadAcceptedRecord();

export const useTermsStore = create<TermsState>((set) => ({
  acceptedVersion: acceptedRecord?.version ?? null,
  acceptedAt: acceptedRecord?.acceptedAt ?? null,
  requiresAcceptance: acceptedRecord?.version !== TERMS_VERSION,
  dialogOpen: acceptedRecord?.version !== TERMS_VERSION,
  mode: 'accept',

  accept: () => {
    const record: AcceptedTermsRecord = { version: TERMS_VERSION, acceptedAt: new Date().toISOString() };
    saveAcceptedRecord(record);
    set({ acceptedVersion: TERMS_VERSION, acceptedAt: record.acceptedAt, requiresAcceptance: false, dialogOpen: false });
    log.info('Terms accepted', TERMS_VERSION);
  },

  rejectTerms: () => {
    log.info('Terms rejected; quitting');
    window.electronAPI?.rejectTerms();
  },

  openViewer: () => {
    set({ mode: 'view', dialogOpen: true });
  },

  closeDialog: () => {
    set({ dialogOpen: false });
  },
}));
