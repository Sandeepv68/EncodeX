/** Action toolbar for the Automations editor. */

import { useTranslation } from 'react-i18next';
import { Button, Chip, TextField } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolderOpen, faFolder, faFloppyDisk, faPlay, faPlus } from '@fortawesome/free-solid-svg-icons';
import { ToolbarRow } from '../../styles/Automations.styles';
import type { AutomationToolbarProps } from './Automation.types';

/** Renders the primary Automations actions and current validation badge. */
export default function AutomationToolbar({
  name,
  issueCount,
  isDirty,
  hasDefinition,
  onRename,
  onNew,
  onOpenLibrary,
  onSave,
  onSelectInput,
  onRun,
}: AutomationToolbarProps) {
  const { t } = useTranslation();
  return (
    <ToolbarRow>
      <TextField
        size="small"
        label={t('automations.fields.name')}
        value={name}
        onChange={(event) => onRename(event.target.value)}
        disabled={!hasDefinition}
      />
      <Button size="small" variant="outlined" startIcon={<FontAwesomeIcon icon={faPlus} />} onClick={onNew}>
        {t('automations.new')}
      </Button>
      <Button size="small" variant="outlined" startIcon={<FontAwesomeIcon icon={faFolderOpen} />} onClick={onOpenLibrary}>
        {t('automations.openLibrary')}
      </Button>
      <Button
        size="small"
        variant="outlined"
        startIcon={<FontAwesomeIcon icon={faFloppyDisk} />}
        onClick={onSave}
        disabled={!hasDefinition}
      >
        {t('automations.save')}
      </Button>
      <Button
        size="small"
        variant="outlined"
        startIcon={<FontAwesomeIcon icon={faFolder} />}
        onClick={onSelectInput}
        disabled={!hasDefinition}
      >
        {t('automations.selectInput')}
      </Button>
      <Button size="small" variant="contained" startIcon={<FontAwesomeIcon icon={faPlay} />} onClick={onRun} disabled={!hasDefinition}>
        {t('automations.run')}
      </Button>
      <Chip
        size="small"
        color={issueCount > 0 ? 'error' : 'success'}
        label={t('automations.issueCount', { count: issueCount })}
        aria-label={t('automations.issueCount', { count: issueCount })}
      />
      {isDirty && <Chip size="small" label={t('automations.unsaved')} variant="outlined" />}
    </ToolbarRow>
  );
}
