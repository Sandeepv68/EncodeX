/** Validation console and interactive local run console for Automations. */

import { useTranslation } from 'react-i18next';
import { Button, FormControl, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faRotateRight, faTrashCan, faXmark } from '@fortawesome/free-solid-svg-icons';
import { AUTOMATION_KIND, AUTOMATION_RUN_STATUS } from '../../../shared/automations/types';
import type { AutomationRunLogEntry } from '../../../shared/automations/types';
import { currentAutomationRun, latestAutomationRun, useAutomationStore } from '../../stores/automationStore';
import {
  ConsoleSection,
  DetailRow,
  EditorPanel,
  EventRow,
  EventTime,
  IssueCode,
  IssueRow,
  PanelHint,
  PanelTitle,
  RunControlRow,
  RunProgress,
  RuntimeInputRow,
  StatusChip,
  TimelineRow,
} from '../../styles/Automations.styles';
import type { AutomationRunPanelProps } from './Automation.types';

/** Formats a run-log timestamp for the event console. */
function eventTime(entry: AutomationRunLogEntry): string {
  return Number.isFinite(entry.timestamp) ? new Date(entry.timestamp).toLocaleTimeString() : '';
}

/** Displays validation issues, run history, and the selected run's progress. */
export default function AutomationRunPanel({ onCancel, onRerun, onProbeInput, onSelectRuntimeInput }: AutomationRunPanelProps) {
  const { t } = useTranslation();
  const validationIssues = useAutomationStore((state) => state.validationIssues);
  const runs = useAutomationStore((state) => state.runs);
  const activeDefinition = useAutomationStore((state) => state.activeDefinition);
  const runtimeInputPath = useAutomationStore((state) => state.runtimeInputPath);
  const setRuntimeInputPath = useAutomationStore((state) => state.setRuntimeInputPath);
  const selectRun = useAutomationStore((state) => state.selectRun);
  const clearRuns = useAutomationStore((state) => state.clearRuns);
  const currentRun = useAutomationStore(currentAutomationRun);
  const latestRun = useAutomationStore(latestAutomationRun);

  const runHistory = Object.values(runs).sort((left, right) => (right.startedAt ?? 0) - (left.startedAt ?? 0));
  const inputNode = activeDefinition?.graph.nodes.find((node) => node.kind === AUTOMATION_KIND.INPUT);
  const inputPath = inputNode?.data.kind === AUTOMATION_KIND.INPUT ? inputNode.data.path : undefined;
  const probePath = runtimeInputPath ?? inputPath;
  const stageNodes = activeDefinition?.graph.nodes.filter((node) => node.kind === AUTOMATION_KIND.STAGE) ?? [];
  const stageStatuses = currentRun?.stageStatuses ?? {};
  const timeline = stageNodes.map((stage) => ({
    id: stage.id,
    name: stage.data.kind === AUTOMATION_KIND.STAGE ? stage.data.name : stage.label,
    status: stageStatuses[stage.id],
  }));
  for (const [stageId, status] of Object.entries(stageStatuses)) {
    if (!timeline.some((item) => item.id === stageId)) {
      timeline.push({ id: stageId, name: t('automations.node.stage'), status });
    }
  }
  const runEvents = currentRun?.events ?? [];
  const isActive = latestRun?.status === AUTOMATION_RUN_STATUS.QUEUED || latestRun?.status === AUTOMATION_RUN_STATUS.RUNNING;

  const handleSelectRun = (event: SelectChangeEvent) => selectRun(event.target.value);

  return (
    <EditorPanel role="region" aria-label={t('automations.runPanelLabel')}>
      <PanelTitle variant="h2">{t('automations.runPanelTitle')}</PanelTitle>
      <ConsoleSection>
        <RunControlRow>
          <FormControl size="small">
            <InputLabel id="automation-run-history-label">{t('automations.runHistory')}</InputLabel>
            <Select
              data-testid="automation-run-history"
              labelId="automation-run-history-label"
              label={t('automations.runHistory')}
              value={currentRun?.runId ?? ''}
              onChange={handleSelectRun}
            >
              {!currentRun && <MenuItem value="">{t('automations.noRunHistory')}</MenuItem>}
              {runHistory.map((run) => (
                <MenuItem key={run.runId} value={run.runId}>
                  {run.automationName || t('automations.run')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            data-testid="automation-cancel-run-panel"
            size="small"
            variant="outlined"
            color="error"
            startIcon={<FontAwesomeIcon icon={faXmark} />}
            onClick={() => latestRun && onCancel(latestRun.runId)}
            disabled={!isActive}
          >
            {t('automations.cancelRun')}
          </Button>
          <Button
            data-testid="automation-rerun"
            size="small"
            variant="outlined"
            startIcon={<FontAwesomeIcon icon={faRotateRight} />}
            onClick={onRerun}
            disabled={!activeDefinition}
          >
            {t('automations.rerun')}
          </Button>
          <Button
            data-testid="automation-clear-history"
            size="small"
            variant="text"
            startIcon={<FontAwesomeIcon icon={faTrashCan} />}
            onClick={clearRuns}
            disabled={runHistory.length === 0}
          >
            {t('automations.clearHistory')}
          </Button>
        </RunControlRow>
        <RuntimeInputRow>
          <TextField
            data-testid="automation-runtime-input"
            size="small"
            fullWidth
            label={t('automations.runtimeInputPath')}
            value={runtimeInputPath ?? ''}
            onChange={(event) => setRuntimeInputPath(event.target.value || null)}
          />
          <Button data-testid="automation-browse-runtime-input" size="small" variant="outlined" onClick={onSelectRuntimeInput}>
            {t('automations.browse')}
          </Button>
          <Button
            data-testid="automation-probe-input"
            size="small"
            variant="outlined"
            startIcon={<FontAwesomeIcon icon={faMagnifyingGlass} />}
            onClick={() => onProbeInput()}
            disabled={!probePath}
          >
            {t('automations.probeInput')}
          </Button>
        </RuntimeInputRow>
        <PanelHint>{t('automations.probeHint')}</PanelHint>
      </ConsoleSection>

      {currentRun && (
        <ConsoleSection>
          <StatusChip label={t(`automations.status.${currentRun.status}`)} $status={currentRun.status} variant="outlined" />
          <Typography data-testid="automation-run-status-live" role="status" aria-live="polite" variant="body2">
            {t('automations.runStatusAnnouncement', { status: t(`automations.status.${currentRun.status}`) })}
          </Typography>
          <RunProgress
            data-testid="automation-run-progress"
            variant="determinate"
            value={currentRun.progress}
            aria-label={t('automations.runProgress')}
          />
          {currentRun.message && <PanelHint data-testid="automation-run-message">{currentRun.message}</PanelHint>}
          {currentRun.runtimeInputPath && (
            <DetailRow data-testid="automation-run-input-path">
              <Typography variant="body2" component="span">
                {t('automations.runtimeInputPath')}:
              </Typography>
              <Typography variant="body2" component="span">
                {currentRun.runtimeInputPath}
              </Typography>
            </DetailRow>
          )}
          {currentRun.outputPath && (
            <DetailRow data-testid="automation-run-output-path">
              <Typography variant="body2" component="span">
                {t('automations.outputPath')}:
              </Typography>
              <Typography variant="body2" component="span">
                {currentRun.outputPath}
              </Typography>
            </DetailRow>
          )}
          {currentRun.error && (
            <DetailRow data-testid="automation-run-error" $error>
              <Typography variant="body2" component="span">
                {t('automations.error')}:
              </Typography>
              <Typography variant="body2" component="span">
                {currentRun.error}
              </Typography>
            </DetailRow>
          )}
        </ConsoleSection>
      )}

      {currentRun && (
        <ConsoleSection>
          <PanelTitle variant="body2">{t('automations.stageTimeline')}</PanelTitle>
          {timeline.length === 0 && <PanelHint>{t('automations.noStages')}</PanelHint>}
          {timeline.map((stage) => (
            <TimelineRow key={stage.id} data-testid={`automation-stage-${stage.id}`}>
              <Typography variant="body2">{stage.name}</Typography>
              <StatusChip
                label={t(`automations.status.${stage.status ?? AUTOMATION_RUN_STATUS.QUEUED}`)}
                $status={stage.status}
                variant="outlined"
              />
            </TimelineRow>
          ))}
        </ConsoleSection>
      )}

      {currentRun && (
        <ConsoleSection>
          <PanelTitle variant="body2">{t('automations.runEvents')}</PanelTitle>
          {runEvents.length === 0 && <PanelHint>{t('automations.noRunEvents')}</PanelHint>}
          {runEvents.map((event, index) => (
            <EventRow key={`${eventTime(event)}-${index}`} data-testid={`automation-event-${index}`}>
              <EventTime>{eventTime(event)}</EventTime>
              <StatusChip label={t(`automations.status.${event.status}`)} $status={event.status} variant="outlined" />
              <Typography variant="body2">{event.message ?? ''}</Typography>
            </EventRow>
          ))}
        </ConsoleSection>
      )}

      <ConsoleSection>
        {validationIssues.map((issue, index) => (
          <IssueRow key={`${issue.code}-${issue.nodeId ?? index}`} data-testid={`automation-issue-${issue.code}`}>
            <IssueCode>{issue.code}</IssueCode>
            <Typography variant="body2">{issue.message}</Typography>
          </IssueRow>
        ))}
        {validationIssues.length === 0 && !currentRun && <PanelHint>{t('automations.noIssues')}</PanelHint>}
        {currentRun?.status === AUTOMATION_RUN_STATUS.QUEUED && <PanelHint>{t('automations.runQueuedHint')}</PanelHint>}
      </ConsoleSection>
    </EditorPanel>
  );
}
