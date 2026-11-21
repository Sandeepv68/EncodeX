/** Drawer listing locally saved automation definitions. */

import { useTranslation } from 'react-i18next';
import { Button, Drawer, IconButton, List, ListItemButton, ListItemText, Typography } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useAutomationStore } from '../../stores/automationStore';
import { DrawerActions, DrawerHeader, LibraryRow } from '../../styles/Automations.styles';
import type { AutomationLibraryDrawerProps } from './Automation.types';

/** Shows saved automations and exposes new/load/save actions. */
export default function AutomationLibraryDrawer({ open, onClose }: AutomationLibraryDrawerProps) {
  const { t } = useTranslation();
  const definitions = useAutomationStore((state) => state.definitions);
  const activeDefinition = useAutomationStore((state) => state.activeDefinition);
  const newAutomation = useAutomationStore((state) => state.newAutomation);
  const loadAutomation = useAutomationStore((state) => state.loadAutomation);
  const saveAutomation = useAutomationStore((state) => state.saveAutomation);

  return (
    <Drawer anchor="right" open={open} onClose={onClose} aria-label={t('automations.libraryTitle')}>
      <DrawerHeader>
        <Typography variant="subtitle1">{t('automations.libraryTitle')}</Typography>
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
        <Button size="small" variant="contained" onClick={saveAutomation} disabled={!activeDefinition}>
          {t('automations.save')}
        </Button>
      </DrawerActions>
      <List>
        {definitions.map((definition) => (
          <LibraryRow key={definition.id}>
            <ListItemButton
              onClick={() => {
                loadAutomation(definition.id);
                onClose();
              }}
            >
              <ListItemText primary={definition.name} secondary={t('automations.libraryVersion', { version: definition.version })} />
            </ListItemButton>
          </LibraryRow>
        ))}
      </List>
    </Drawer>
  );
}
