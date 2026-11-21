/** Drawer listing locally saved automation definitions. */

import { useTranslation } from 'react-i18next';
import { Button, Drawer, IconButton, List, ListItemButton, ListItemText, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faDownload, faFileExport, faFileImport, faPlus, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useAutomations } from '../../hooks/useAutomations';
import { DrawerActions, DrawerHeader, LibraryActions, LibraryRow } from '../../styles/Automations.styles';
import type { AutomationLibraryDrawerProps } from './Automation.types';

/** Shows saved automations and exposes library actions. */
export default function AutomationLibraryDrawer({ open, onClose }: AutomationLibraryDrawerProps) {
  const { t } = useTranslation();
  const {
    definitions,
    activeDefinition,
    newAutomation,
    saveAutomation,
    loadAutomation,
    duplicateAutomation,
    deleteAutomation,
    importAutomation,
    exportAutomation,
  } = useAutomations();

  return (
    <Drawer anchor="right" open={open} onClose={onClose} aria-label={t('automations.libraryTitle')}>
      <DrawerHeader>
        <Typography component="h2" variant="subtitle1">
          {t('automations.libraryTitle')}
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label={t('automations.close')}>
          <FontAwesomeIcon icon={faXmark} />
        </IconButton>
      </DrawerHeader>
      <DrawerActions>
        <Button
          size="small"
          variant="outlined"
          startIcon={<FontAwesomeIcon icon={faPlus} />}
          onClick={() => {
            newAutomation();
            onClose();
          }}
        >
          {t('automations.new')}
        </Button>
        <Button size="small" variant="contained" onClick={() => void saveAutomation()} disabled={!activeDefinition}>
          {t('automations.save')}
        </Button>
        <Button size="small" variant="outlined" startIcon={<FontAwesomeIcon icon={faFileImport} />} onClick={() => void importAutomation()}>
          {t('automations.import')}
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<FontAwesomeIcon icon={faFileExport} />}
          onClick={() => activeDefinition && void exportAutomation(activeDefinition.id)}
          disabled={!activeDefinition}
        >
          {t('automations.export')}
        </Button>
      </DrawerActions>
      <List>
        {definitions.map((definition) => (
          <LibraryRow key={definition.id} data-testid={`automation-library-${definition.id}`}>
            <ListItemButton
              data-testid={`automation-library-open-${definition.id}`}
              onClick={() => {
                void loadAutomation(definition.id);
                onClose();
              }}
            >
              <ListItemText primary={definition.name} secondary={t('automations.libraryVersion', { version: definition.version })} />
            </ListItemButton>
            <LibraryActions>
              <IconButton size="small" aria-label={t('automations.duplicate')} onClick={() => void duplicateAutomation(definition.id)}>
                <FontAwesomeIcon icon={faCopy} />
              </IconButton>
              <IconButton size="small" aria-label={t('automations.delete')} onClick={() => void deleteAutomation(definition.id)}>
                <FontAwesomeIcon icon={faTrash} />
              </IconButton>
              <IconButton
                size="small"
                aria-label={t('automations.exportDefinition', { name: definition.name })}
                onClick={() => void exportAutomation(definition.id)}
              >
                <FontAwesomeIcon icon={faDownload} />
              </IconButton>
            </LibraryActions>
          </LibraryRow>
        ))}
      </List>
    </Drawer>
  );
}
