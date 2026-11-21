/** Inspector for the selected node on the Automations canvas. */

import { useTranslation } from 'react-i18next';
import { FormControl, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import type { AutomationMediaKind } from '../../../shared/automations/types';
import { AUTOMATION_BACKENDS } from '../../../shared/automations/defaults';
import { AUTOMATION_KIND } from '../../../shared/automations/types';
import { useAutomationStore } from '../../stores/automationStore';
import { EditorPanel, PanelHint, PanelTitle } from '../../styles/Automations.styles';
import AutomationOperationFields from './AutomationOperationFields';

/** Edits the label, payload, and stage assignment of the selected node. */
export default function AutomationInspector() {
  const { t } = useTranslation();
  const activeDefinition = useAutomationStore((state) => state.activeDefinition);
  const selectedNodeId = useAutomationStore((state) => state.selectedNodeId);
  const updateNode = useAutomationStore((state) => state.updateNode);
  const node = activeDefinition?.graph.nodes.find((item) => item.id === selectedNodeId);

  if (!node) {
    return (
      <EditorPanel role="complementary" aria-label={t('automations.inspectorLabel')}>
        <PanelTitle variant="subtitle1">{t('automations.inspectorTitle')}</PanelTitle>
        <PanelHint>{t('automations.inspectorEmpty')}</PanelHint>
      </EditorPanel>
    );
  }

  const inputData = node.data.kind === AUTOMATION_KIND.INPUT ? node.data : null;
  const outputData = node.data.kind === AUTOMATION_KIND.OUTPUT ? node.data : null;

  return (
    <EditorPanel role="complementary" aria-label={t('automations.inspectorLabel')}>
      <PanelTitle variant="subtitle1">{t('automations.inspectorTitle')}</PanelTitle>
      <TextField
        size="small"
        label={t('automations.fields.label')}
        value={node.label}
        onChange={(event) => updateNode(node.id, { label: event.target.value })}
      />
      <PanelHint>{t(`automations.node.${node.kind}`)}</PanelHint>

      {node.data.kind === AUTOMATION_KIND.INPUT && (
        <TextField
          size="small"
          label={t('automations.fields.inputPath')}
          value={inputData?.path ?? ''}
          onChange={(event) => updateNode(node.id, { data: { kind: AUTOMATION_KIND.INPUT, path: event.target.value } })}
        />
      )}

      {node.data.kind === AUTOMATION_KIND.STAGE && (
        <TextField
          size="small"
          label={t('automations.fields.stageName')}
          value={node.data.name}
          onChange={(event) => updateNode(node.id, { data: { kind: AUTOMATION_KIND.STAGE, name: event.target.value } })}
        />
      )}

      {node.data.kind === AUTOMATION_KIND.OUTPUT && (
        <>
          <TextField
            size="small"
            label={t('automations.fields.outputPath')}
            value={outputData?.path ?? ''}
            onChange={(event) => updateNode(node.id, { data: { kind: AUTOMATION_KIND.OUTPUT, path: event.target.value } })}
          />
          <TextField
            size="small"
            label={t('automations.fields.extension')}
            value={outputData?.extension ?? ''}
            onChange={(event) =>
              updateNode(node.id, { data: { kind: AUTOMATION_KIND.OUTPUT, path: outputData?.path ?? '', extension: event.target.value } })
            }
          />
        </>
      )}

      {node.data.kind !== AUTOMATION_KIND.INPUT &&
        node.data.kind !== AUTOMATION_KIND.STAGE &&
        node.data.kind !== AUTOMATION_KIND.OUTPUT && (
          <AutomationOperationFields node={node} defaultBackend={activeDefinition?.settings.defaultBackend ?? AUTOMATION_BACKENDS[0]} />
        )}

      {node.data.kind === AUTOMATION_KIND.INPUT && (
        <FormControl size="small" fullWidth>
          <InputLabel id="automation-media-kind-label">{t('automations.fields.mediaKind')}</InputLabel>
          <Select
            labelId="automation-media-kind-label"
            label={t('automations.fields.mediaKind')}
            value={inputData?.mediaKind ?? 'unknown'}
            onChange={(event: SelectChangeEvent) =>
              updateNode(node.id, {
                data: { kind: AUTOMATION_KIND.INPUT, path: inputData?.path, mediaKind: event.target.value as AutomationMediaKind },
              })
            }
          >
            {(['unknown', 'video', 'audio', 'image'] as AutomationMediaKind[]).map((mediaKind) => (
              <MenuItem key={mediaKind} value={mediaKind}>
                {t(`automations.mediaKind.${mediaKind}`)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </EditorPanel>
  );
}
