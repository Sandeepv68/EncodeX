/** Operation-specific fields for the Automations inspector. */

import { useTranslation } from 'react-i18next';
import { FormControl, FormControlLabel, InputLabel, MenuItem, Select, Switch, TextField } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import type { ConversionOptions } from '../../../shared/types';
import type { AutomationBackend, OperationNodeData } from '../../../shared/automations/types';
import { AUTOMATION_BACKENDS } from '../../../shared/automations/defaults';
import { useAutomationStore } from '../../stores/automationStore';
import type { AutomationOperationFieldsProps } from './Automation.types';

/** Renders editable settings shared by executable operation nodes. */
export default function AutomationOperationFields({ node, defaultBackend }: AutomationOperationFieldsProps) {
  const { t } = useTranslation();
  const updateNode = useAutomationStore((state) => state.updateNode);
  const backendStatus = useAutomationStore((state) => state.backendStatus);
  const data = node.data as OperationNodeData;
  const currentBackend = data.backend ?? defaultBackend;
  const visibleBackends = AUTOMATION_BACKENDS.filter((backend) => backendStatus[backend] || backend === currentBackend);

  const updateOption = <K extends keyof ConversionOptions>(key: K, value: ConversionOptions[K]) => {
    updateNode(node.id, { data: { ...data, options: { ...data.options, [key]: value } } });
  };

  return (
    <>
      <FormControl size="small" fullWidth>
        <InputLabel id="automation-backend-label">{t('automations.fields.backend')}</InputLabel>
        <Select
          labelId="automation-backend-label"
          label={t('automations.fields.backend')}
          value={currentBackend}
          onChange={(event: SelectChangeEvent) =>
            updateNode(node.id, { data: { ...data, backend: event.target.value as AutomationBackend } })
          }
        >
          {visibleBackends.map((backend) => (
            <MenuItem key={backend} value={backend} disabled={!backendStatus[backend]}>
              {backend}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        size="small"
        label={t('automations.fields.videoCodec')}
        value={data.options.videoCodec ?? ''}
        onChange={(event) => updateOption('videoCodec', event.target.value)}
      />
      <TextField
        size="small"
        label={t('automations.fields.audioCodec')}
        value={data.options.audioCodec ?? ''}
        onChange={(event) => updateOption('audioCodec', event.target.value)}
      />
      <TextField
        size="small"
        label={t('automations.fields.startTime')}
        value={data.options.startTime ?? ''}
        onChange={(event) => updateOption('startTime', event.target.value)}
      />
      <TextField
        size="small"
        label={t('automations.fields.endTime')}
        value={data.options.endTime ?? ''}
        onChange={(event) => updateOption('endTime', event.target.value)}
      />
      <FormControlLabel
        control={<Switch checked={data.options.copy ?? false} onChange={(event) => updateOption('copy', event.target.checked)} />}
        label={t('automations.fields.copy')}
      />
    </>
  );
}
