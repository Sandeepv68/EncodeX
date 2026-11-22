import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderPage } from '../../../test-utils/page-render';
import { useAutomationStore } from '../../stores/automationStore';
import { useToastStore } from '../../stores/toastStore';
import {
  AUTOMATION_BACKENDS,
  createAutomationDefinition,
  createAutomationEdge,
  createAutomationNode,
} from '../../../shared/automations/defaults';
import { AUTOMATION_KIND, AUTOMATION_RUN_STATUS } from '../../../shared/automations/types';
import type { AutomationBackend, AutomationDefinition } from '../../../shared/automations/types';
import type { MediaInfo } from '../../../shared/types';

const electronApi = window.electronAPI as unknown as Record<string, unknown>;
const originalMethods = { ...electronApi };
const selectFileMock = vi.mocked(window.electronAPI.selectFile);
const getMediaInfoMock = vi.mocked(window.electronAPI.getMediaInfo);
const defaultMediaInfo: MediaInfo = {
  file: '/in.mp4',
  format: 'mp4',
  size: 100,
  duration: 5,
  bitrate: '100k',
  streams: [{ index: 0, type: 'video', codec: 'h264' }],
};

function bridge(): Record<string, unknown> {
  return window.electronAPI as unknown as Record<string, unknown>;
}

function definition(id: string, name: string): AutomationDefinition {
  return createAutomationDefinition(id, name, 1);
}

function runnableDefinition(): AutomationDefinition {
  return createAutomationDefinition('a', 'Alpha', 1, {
    graph: {
      nodes: [
        createAutomationNode(
          'n1',
          AUTOMATION_KIND.INPUT,
          { x: 0, y: 0 },
          {
            data: { kind: AUTOMATION_KIND.INPUT, path: '/in.mp4', mediaKind: 'video' },
          },
        ),
        createAutomationNode(
          'n2',
          AUTOMATION_KIND.OUTPUT,
          { x: 1, y: 0 },
          {
            data: { kind: AUTOMATION_KIND.OUTPUT, path: '/out.mp4' },
          },
        ),
      ],
      edges: [createAutomationEdge('n1', 'n2')],
    },
  });
}

function backendStatus(): Record<AutomationBackend, boolean> {
  return AUTOMATION_BACKENDS.reduce<Record<AutomationBackend, boolean>>(
    (status, backend) => {
      status[backend] = true;
      return status;
    },
    {} as Record<AutomationBackend, boolean>,
  );
}

describe('Automations page branch coverage', () => {
  beforeEach(() => {
    useAutomationStore.setState({
      definitions: [],
      activeDefinition: null,
      selectedNodeId: null,
      validationIssues: [],
      isDirty: false,
      isInitialized: false,
      runs: {},
      runtimeInputPath: null,
      detectedMediaKind: null,
      selectedRunId: null,
      backendStatus: backendStatus(),
    });
    useToastStore.setState({ toasts: [] });
    selectFileMock.mockReset().mockResolvedValue(null);
    getMediaInfoMock.mockReset().mockResolvedValue(defaultMediaInfo);
    vi.mocked(window.electronAPI.onAutomationStatus)
      .mockReset()
      .mockImplementation(() => vi.fn());
    vi.mocked(window.electronAPI.onAutomationEvent)
      .mockReset()
      .mockImplementation(() => vi.fn());
    vi.mocked(window.electronAPI.onAutomationProgress)
      .mockReset()
      .mockImplementation(() => vi.fn());
    bridge().getBmfStatus = vi.fn().mockResolvedValue({ available: true, missing: [] });
    bridge().automationList = vi.fn().mockResolvedValue([]);
    bridge().automationGet = vi.fn().mockResolvedValue(null);
    bridge().automationSave = vi.fn().mockImplementation((candidate: AutomationDefinition) => Promise.resolve(candidate));
    bridge().automationDelete = vi.fn().mockResolvedValue(false);
    bridge().automationDuplicate = vi.fn().mockResolvedValue(null);
    bridge().automationImport = vi.fn().mockResolvedValue(null);
    bridge().automationExport = vi.fn().mockResolvedValue(null);
    bridge().automationStart = vi.fn().mockResolvedValue('run-page');
    bridge().automationCancel = vi.fn().mockResolvedValue(true);
  });

  afterEach(() => {
    const current = bridge();
    for (const key of Object.keys(current)) {
      if (!(key in originalMethods)) delete current[key];
    }
    Object.assign(current, originalMethods);
    selectFileMock.mockReset().mockResolvedValue(null);
    getMediaInfoMock.mockReset().mockResolvedValue(defaultMediaInfo);
  });

  it('creates a new definition from the toolbar and closes the library', async () => {
    const active = definition('a', 'Alpha');
    useAutomationStore.setState({ activeDefinition: active, definitions: [active] });
    bridge().automationList = vi.fn().mockResolvedValue([active]);
    renderPage('Automations');

    fireEvent.click(screen.getByTestId('automation-open-library'));
    fireEvent.click(screen.getByTestId('automation-new'));

    await waitFor(() => expect(useAutomationStore.getState().activeDefinition?.id).not.toBe('a'));
    await waitFor(() => expect(screen.queryByLabelText('automations.libraryTitle')).not.toBeInTheDocument());
  });

  it('selects an input file from the toolbar', async () => {
    selectFileMock.mockResolvedValue('/dialog.mp4');
    useAutomationStore.setState({ activeDefinition: runnableDefinition() });
    renderPage('Automations');

    fireEvent.click(screen.getByTestId('automation-select-input'));

    await waitFor(() => expect(selectFileMock).toHaveBeenCalled());
    await waitFor(() => expect(useAutomationStore.getState().activeDefinition?.graph.nodes[0].data).toMatchObject({ path: '/dialog.mp4' }));
  });

  it('selects a runtime input file from the run console', async () => {
    selectFileMock.mockResolvedValue('/runtime.mov');
    useAutomationStore.setState({ activeDefinition: runnableDefinition() });
    renderPage('Automations');

    fireEvent.click(screen.getByTestId('automation-browse-runtime-input'));

    await waitFor(() => expect(useAutomationStore.getState().runtimeInputPath).toBe('/runtime.mov'));
  });

  it('cancels the selected run from the run console', async () => {
    const cancel = vi.fn().mockResolvedValue(true);
    bridge().automationCancel = cancel;
    useAutomationStore.setState({
      activeDefinition: runnableDefinition(),
      selectedRunId: 'run-panel',
      runs: {
        'run-panel': {
          runId: 'run-panel',
          automationId: 'a',
          automationName: 'Alpha',
          startedAt: 1,
          updatedAt: 2,
          status: AUTOMATION_RUN_STATUS.RUNNING,
          progress: 25,
          nodeStatuses: {},
          stageStatuses: {},
          events: [],
        },
      },
    });
    renderPage('Automations');

    fireEvent.click(screen.getByTestId('automation-cancel-run-panel'));

    await waitFor(() => expect(cancel).toHaveBeenCalledWith('run-panel'));
  });

  it('closes the Save As dialog from the backdrop and the cancel button', async () => {
    useAutomationStore.setState({ activeDefinition: definition('a', 'Alpha') });
    renderPage('Automations');

    fireEvent.click(screen.getByTestId('automation-save-as'));
    await screen.findByRole('dialog');
    fireEvent.click(document.querySelector('.MuiBackdrop-root') as Element);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    fireEvent.click(screen.getByTestId('automation-save-as'));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByTestId('automation-save-as-cancel'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
