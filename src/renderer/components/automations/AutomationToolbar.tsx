/** Action toolbar for the Automations editor. */

import { useTranslation } from 'react-i18next';
import { Button, Chip, TextField } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCopy,
  faDownload,
  faFloppyDisk,
  faFolder,
  faFolderOpen,
  faPlay,
  faPlus,
  faTrash,
  faUpload,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
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
  onSaveAs,
  onDuplicate,
  onDelete,
  onImport,
  onExport,
  onSelectInput,
  onRun,
  isRunning,
  onCancel,
}: AutomationToolbarProps) {
  const { t } = useTranslation();
  return (
    <ToolbarRow>
      <TextField
        data-testid="automation-name"
        size="small"
        label={t('automations.fields.name')}
        value={name}
        onChange={(event) => onRename(event.target.value)}
        disabled={!hasDefinition}
        slotProps={{ htmlInput: { 'data-testid': 'automation-name-input' } }}
      />
      <Button data-testid="automation-new" size="small" variant="outlined" startIcon={<FontAwesomeIcon icon={faPlus} />} onClick={onNew}>
        {t('automations.new')}
      </Button>
      <Button
        data-testid="automation-open-library"
        size="small"
        variant="outlined"
        startIcon={<FontAwesomeIcon icon={faFolderOpen} />}
        onClick={onOpenLibrary}
      >
        {t('automations.openLibrary')}
      </Button>
      <Button
        data-testid="automation-save"
        size="small"
        variant="outlined"
        startIcon={<FontAwesomeIcon icon={faFloppyDisk} />}
        onClick={onSave}
        disabled={!hasDefinition}
      >
        {t('automations.save')}
      </Button>
      <Button
        data-testid="automation-save-as"
        size="small"
        variant="outlined"
        startIcon={<FontAwesomeIcon icon={faFloppyDisk} />}
        onClick={onSaveAs}
        disabled={!hasDefinition}
      >
        {t('automations.saveAs')}
      </Button>
      <Button
        data-testid="automation-duplicate"
        size="small"
        variant="outlined"
        startIcon={<FontAwesomeIcon icon={faCopy} />}
        onClick={onDuplicate}
        disabled={!hasDefinition}
      >
        {t('automations.duplicate')}
      </Button>
      <Button
        data-testid="automation-delete"
        size="small"
        variant="outlined"
        startIcon={<FontAwesomeIcon icon={faTrash} />}
        onClick={onDelete}
        disabled={!hasDefinition}
      >
        {t('automations.delete')}
      </Button>
      <Button
        data-testid="automation-import"
        size="small"
        variant="outlined"
        startIcon={<FontAwesomeIcon icon={faUpload} />}
        onClick={onImport}
      >
        {t('automations.import')}
      </Button>
      <Button
        data-testid="automation-export"
        size="small"
        variant="outlined"
        startIcon={<FontAwesomeIcon icon={faDownload} />}
        onClick={onExport}
        disabled={!hasDefinition}
      >
        {t('automations.export')}
      </Button>
      <Button
        data-testid="automation-select-input"
        size="small"
        variant="outlined"
        startIcon={<FontAwesomeIcon icon={faFolder} />}
        onClick={onSelectInput}
        disabled={!hasDefinition}
      >
        {t('automations.selectInput')}
      </Button>
      <Button
        data-testid="automation-run"
        size="small"
        variant="contained"
        startIcon={<FontAwesomeIcon icon={faPlay} />}
        onClick={() => onRun()}
        disabled={!hasDefinition}
      >
        {t('automations.run')}
      </Button>
      <Button
        data-testid="automation-cancel-run"
        size="small"
        variant="outlined"
        color="error"
        startIcon={<FontAwesomeIcon icon={faXmark} />}
        onClick={onCancel}
        disabled={!isRunning || !hasDefinition}
      >
        {t('automations.cancelRun')}
      </Button>
      <Chip
        data-testid="automation-issue-count"
        size="small"
        color={issueCount > 0 ? 'error' : 'success'}
        label={t('automations.issueCount', { count: issueCount })}
        aria-label={t('automations.issueCount', { count: issueCount })}
      />
      {isDirty && <Chip data-testid="automation-unsaved" size="small" label={t('automations.unsaved')} variant="outlined" />}
    </ToolbarRow>
  );
}
