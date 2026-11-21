/** Validation console and local run status panel for Automations. */

import { useTranslation } from 'react-i18next';
import { Typography } from '@mui/material';
import { AUTOMATION_RUN_STATUS } from '../../../shared/automations/types';
import { useAutomationStore } from '../../stores/automationStore';
import { EditorPanel, IssueCode, IssueRow, PanelHint, PanelTitle, RunProgress, StatusChip } from '../../styles/Automations.styles';

/** Displays validation issues and the latest local run progress. */
export default function AutomationRunPanel() {
  const { t } = useTranslation();
  const validationIssues = useAutomationStore((state) => state.validationIssues);
  const runs = useAutomationStore((state) => state.runs);
  const currentRun = Object.values(runs)[0];

  return (
    <EditorPanel role="region" aria-label={t('automations.runPanelLabel')}>
      <PanelTitle variant="subtitle1">{t('automations.runPanelTitle')}</PanelTitle>
      {currentRun && (
        <>
          <StatusChip label={t(`automations.status.${currentRun.status}`)} $status={currentRun.status} variant="outlined" />
          <RunProgress variant="determinate" value={currentRun.progress} aria-label={t('automations.runProgress')} />
          {currentRun.message && <PanelHint>{currentRun.message}</PanelHint>}
        </>
      )}
      {validationIssues.length === 0 && !currentRun && <PanelHint>{t('automations.noIssues')}</PanelHint>}
      {validationIssues.map((issue, index) => (
        <IssueRow key={`${issue.code}-${issue.nodeId ?? index}`}>
          <IssueCode>{issue.code}</IssueCode>
          <Typography variant="body2">{issue.message}</Typography>
        </IssueRow>
      ))}
      {currentRun?.status === AUTOMATION_RUN_STATUS.QUEUED && <PanelHint>{t('automations.runQueuedHint')}</PanelHint>}
    </EditorPanel>
  );
}
