/**
 * @fileoverview Keyboard shortcuts reference dialog.
 *
 * Renders a modal dialog listing every registered shortcut grouped by the
 * sections defined in `SHORTCUT_SECTIONS`. Each row shows the localized action
 * label next to its platform-formatted key chord.
 */

import { useTranslation } from 'react-i18next';
import { Box } from '@mui/material';
import { faKeyboard } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { SHORTCUT_SECTIONS, SHORTCUTS, formatShortcut } from '../constants/shortcuts';
import AppDialog from './AppDialog';
import type { ShortcutsHelpDialogProps } from './types';
import {
  ShortcutsContent,
  ShortcutsDialogPaper,
  ShortcutsSectionTitle,
  ShortcutKey,
  ShortcutLabel,
  ShortcutRow,
} from '../styles/ShortcutsHelpDialog.styles';

export type { ShortcutsHelpDialogProps };

/**
 * Renders the shortcuts help dialog.
 *
 * @param {ShortcutsHelpDialogProps} props - Component props.
 * @returns {JSX.Element} The rendered dialog.
 */
export default function ShortcutsHelpDialog({ open, onClose }: ShortcutsHelpDialogProps) {
  const { t } = useTranslation();

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={t('shortcuts.title')}
      icon={<FontAwesomeIcon icon={faKeyboard} />}
      showCloseButton
      closeButtonAriaLabel={t('shortcuts.close')}
      closeButtonTestId="shortcuts-help-close"
      paperTestId="shortcuts-help-dialog"
      PaperComponent={ShortcutsDialogPaper}
      disableContentPadding
    >
      <ShortcutsContent>
        {SHORTCUT_SECTIONS.map((section) => {
          const items = SHORTCUTS.filter((shortcut) => shortcut.section === section.id);
          if (items.length === 0) return null;
          return (
            <Box component="section" key={section.id}>
              <ShortcutsSectionTitle variant="subtitle2">{t(section.labelKey)}</ShortcutsSectionTitle>
              {items.map((shortcut) => (
                <ShortcutRow key={shortcut.id}>
                  <ShortcutLabel variant="body2">{t(shortcut.labelKey)}</ShortcutLabel>
                  <ShortcutKey>{formatShortcut(shortcut.keys)}</ShortcutKey>
                </ShortcutRow>
              ))}
            </Box>
          );
        })}
      </ShortcutsContent>
    </AppDialog>
  );
}
