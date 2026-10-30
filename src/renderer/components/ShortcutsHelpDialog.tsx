/**
 * @fileoverview Keyboard shortcuts reference dialog.
 *
 * Renders a modal MUI Dialog listing every registered shortcut grouped by the
 * sections defined in `SHORTCUT_SECTIONS`. Each row shows the localized action
 * label next to its platform-formatted key chord. The dialog is fully
 * controlled: the parent decides visibility via `open` and receives the
 * `onClose` callback; the backdrop and Escape route through `onClose` because
 * the underlying MUI Dialog wires those events to it. An explicit close button
 * is rendered in the title bar for discoverability.
 *
 * Props (see {@link ShortcutsHelpDialogProps}):
 *  - open: whether the dialog is shown.
 *  - onClose: fired when the dialog is dismissed.
 */

import { useTranslation } from 'react-i18next';
import { DialogContent, DialogTitle } from '@mui/material';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { SHORTCUT_SECTIONS, SHORTCUTS, formatShortcut } from '../constants/shortcuts';
import type { ShortcutsHelpDialogProps } from './types';
import {
  ShortcutsContent,
  ShortcutsDialog,
  ShortcutsSectionTitle,
  ShortcutKey,
  ShortcutLabel,
  ShortcutRow,
  ShortcutsCloseButton,
} from '../styles/ShortcutsHelpDialog.styles';

export type { ShortcutsHelpDialogProps };

/**
 * Renders the shortcuts help dialog.
 *
 * Iterates the ordered section list and, for each section, renders its
 * registered shortcuts as label + key-chip rows. Sections without entries are
 * skipped.
 *
 * @param {ShortcutsHelpDialogProps} props - Component props.
 * @param {boolean} props.open - Controls dialog visibility.
 * @param {() => void} props.onClose - Fired when the dialog is dismissed.
 * @returns {JSX.Element} The rendered dialog.
 */
export default function ShortcutsHelpDialog({ open, onClose }: ShortcutsHelpDialogProps) {
  const { t } = useTranslation();

  return (
    <ShortcutsDialog
      open={open}
      onClose={onClose}
      aria-labelledby="shortcuts-help-title"
      slotProps={{ paper: { 'data-testid': 'shortcuts-help-dialog' } }}
    >
      <DialogTitle id="shortcuts-help-title">{t('shortcuts.title')}</DialogTitle>
      <ShortcutsCloseButton aria-label={t('shortcuts.close')} onClick={onClose} data-testid="shortcuts-help-close">
        <FontAwesomeIcon icon={faXmark} />
      </ShortcutsCloseButton>
      <DialogContent>
        <ShortcutsContent>
          {SHORTCUT_SECTIONS.map((section) => {
            const items = SHORTCUTS.filter((shortcut) => shortcut.section === section.id);
            if (items.length === 0) return null;
            return (
              <section key={section.id}>
                <ShortcutsSectionTitle variant="subtitle2">{t(section.labelKey)}</ShortcutsSectionTitle>
                {items.map((shortcut) => (
                  <ShortcutRow key={shortcut.id}>
                    <ShortcutLabel variant="body2">{t(shortcut.labelKey)}</ShortcutLabel>
                    <ShortcutKey>{formatShortcut(shortcut.keys)}</ShortcutKey>
                  </ShortcutRow>
                ))}
              </section>
            );
          })}
        </ShortcutsContent>
      </DialogContent>
    </ShortcutsDialog>
  );
}
