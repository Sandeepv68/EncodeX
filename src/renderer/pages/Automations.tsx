/**
 * @fileoverview Automations page: visual pipeline editor with a persisted
 * definition library.
 *
 * This page composes the shared editor store, React Flow canvas, node palette,
 * inspector, stage list, validation console, local run panel, and library
 * drawer. The bridge-loaded library is initialized on mount before a blank
 * definition is created for a new session.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactFlowProvider } from '@xyflow/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDiagramProject } from '@fortawesome/free-solid-svg-icons';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { AUTOMATION_RUN_STATUS } from '../../shared/automations/types';
import PageContainer from '../components/PageContainer';
import AutomationCanvas from '../components/automations/AutomationCanvas';
import AutomationInspector from '../components/automations/AutomationInspector';
import AutomationLibraryDrawer from '../components/automations/AutomationLibraryDrawer';
import AutomationNodePalette from '../components/automations/AutomationNodePalette';
import AutomationRunPanel from '../components/automations/AutomationRunPanel';
import AutomationStageList from '../components/automations/AutomationStageList';
import AutomationToolbar from '../components/automations/AutomationToolbar';
import { useAutomations } from '../hooks/useAutomations';
import { latestAutomationRun, useAutomationStore } from '../stores/automationStore';
import { EditorGrid, EditorLayout } from '../styles/Automations.styles';

/** Renders the `/automations` route. */
export default function Automations() {
  const { t } = useTranslation();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const {
    activeDefinition,
    validationIssues,
    isDirty,
    initialize,
    newAutomation,
    renameAutomation,
    saveAutomation,
    saveAutomationAs,
    duplicateAutomation,
    deleteAutomation,
    importAutomation,
    exportAutomation,
    selectInput,
    run,
    rerun,
    probeInput,
    selectRuntimeInput,
    cancel,
  } = useAutomations();
  const latestRun = useAutomationStore(latestAutomationRun);
  const isRunning = latestRun?.status === AUTOMATION_RUN_STATUS.RUNNING || latestRun?.status === AUTOMATION_RUN_STATUS.QUEUED;

  useEffect(() => {
    let cancelled = false;
    void initialize().then(() => {
      if (cancelled) return;
      if (!useAutomationStore.getState().activeDefinition) newAutomation();
    });
    return () => {
      cancelled = true;
    };
  }, [initialize, newAutomation]);

  const openSaveAs = () => {
    setSaveAsName(activeDefinition?.name ?? '');
    setSaveAsOpen(true);
  };

  const confirmSaveAs = async () => {
    const saved = await saveAutomationAs(saveAsName);
    if (saved) setSaveAsOpen(false);
  };

  return (
    <PageContainer title={t('automations.title')} icon={<FontAwesomeIcon icon={faDiagramProject} />} paper={false} fill>
      <EditorLayout>
        <AutomationToolbar
          name={activeDefinition?.name ?? ''}
          issueCount={validationIssues.length}
          isDirty={isDirty}
          hasDefinition={!!activeDefinition}
          onRename={renameAutomation}
          onNew={() => {
            newAutomation();
            setLibraryOpen(false);
          }}
          onOpenLibrary={() => setLibraryOpen(true)}
          onSave={() => void saveAutomation()}
          onSaveAs={openSaveAs}
          onDuplicate={() => activeDefinition && void duplicateAutomation(activeDefinition.id)}
          onDelete={() => activeDefinition && void deleteAutomation(activeDefinition.id)}
          onImport={() => void importAutomation()}
          onExport={() => activeDefinition && void exportAutomation(activeDefinition.id)}
          onSelectInput={() => void selectInput()}
          onRun={run}
          isRunning={isRunning}
          onCancel={() => latestRun && void cancel(latestRun.runId)}
        />
        <EditorGrid>
          <AutomationNodePalette />
          <ReactFlowProvider>
            <AutomationCanvas />
          </ReactFlowProvider>
          <AutomationStageList />
        </EditorGrid>
        <AutomationInspector />
        <AutomationRunPanel
          onCancel={(runId) => void cancel(runId)}
          onRerun={() => void rerun()}
          onProbeInput={(path) => void probeInput(path)}
          onSelectRuntimeInput={() => void selectRuntimeInput()}
        />
      </EditorLayout>
      <AutomationLibraryDrawer open={libraryOpen} onClose={() => setLibraryOpen(false)} />
      <Dialog open={saveAsOpen} onClose={() => setSaveAsOpen(false)} aria-labelledby="automation-save-as-title" fullWidth maxWidth="xs">
        <DialogTitle id="automation-save-as-title">{t('automations.saveAsTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            label={t('automations.fields.name')}
            value={saveAsName}
            onChange={(event) => setSaveAsName(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveAsOpen(false)}>{t('automations.cancel')}</Button>
          <Button variant="contained" onClick={() => void confirmSaveAs()} disabled={!saveAsName.trim()}>
            {t('automations.saveAsConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
