/** Stage list and creation controls for the Automations editor. */

import { useTranslation } from 'react-i18next';
import { Button, TextField } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { AUTOMATION_KIND, AUTOMATION_RUN_STATUS } from '../../../shared/automations/types';
import { currentAutomationRun, useAutomationStore } from '../../stores/automationStore';
import { EditorPanel, LibraryRow, PanelHint, PanelTitle, StatusChip } from '../../styles/Automations.styles';

/** Lists stage nodes, lets users rename them, and creates new stages. */
export default function AutomationStageList() {
  const { t } = useTranslation();
  const activeDefinition = useAutomationStore((state) => state.activeDefinition);
  const stages = activeDefinition?.graph.nodes.filter((node) => node.kind === AUTOMATION_KIND.STAGE) ?? [];
  const addStage = useAutomationStore((state) => state.addStage);
  const renameStage = useAutomationStore((state) => state.renameStage);
  const selectNode = useAutomationStore((state) => state.selectNode);
  const selectedNodeId = useAutomationStore((state) => state.selectedNodeId);
  const currentRun = useAutomationStore(currentAutomationRun);

  return (
    <EditorPanel role="complementary" aria-label={t('automations.stagesLabel')}>
      <PanelTitle variant="subtitle1">{t('automations.stagesTitle')}</PanelTitle>
      <PanelHint>{t('automations.stagesHint')}</PanelHint>
      <Button
        size="small"
        variant="outlined"
        startIcon={<FontAwesomeIcon icon={faPlus} />}
        onClick={() => addStage(t('automations.newStage'))}
      >
        {t('automations.addStage')}
      </Button>
      {stages.map((stage) => {
        const status = currentRun?.stageStatuses?.[stage.id];
        return (
          <LibraryRow key={stage.id}>
            <TextField
              size="small"
              fullWidth
              value={stage.data.kind === AUTOMATION_KIND.STAGE ? stage.data.name : stage.label}
              onChange={(event) => renameStage(stage.id, event.target.value)}
              onFocus={() => selectNode(stage.id)}
              aria-label={t('automations.fields.stageName')}
              color={stage.id === selectedNodeId ? 'primary' : undefined}
            />
            <StatusChip label={t(`automations.status.${status ?? AUTOMATION_RUN_STATUS.QUEUED}`)} $status={status} variant="outlined" />
          </LibraryRow>
        );
      })}
    </EditorPanel>
  );
}
