import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import {
  AUTOMATION_BACKENDS,
  createAutomationDefinition,
  createAutomationEdge,
  createAutomationNode,
} from '../../../../shared/automations/defaults';
import { AUTOMATION_KIND, AUTOMATION_RUN_STATUS } from '../../../../shared/automations/types';
import type { AutomationBackend, AutomationDefinition } from '../../../../shared/automations/types';
import { useAutomationStore } from '../../../stores/automationStore';
import AutomationCanvas from '../AutomationCanvas';
import AutomationInspector from '../AutomationInspector';
import AutomationLibraryDrawer from '../AutomationLibraryDrawer';
import AutomationNodePalette from '../AutomationNodePalette';
import AutomationOperationFields from '../AutomationOperationFields';
import AutomationRunPanel from '../AutomationRunPanel';
import AutomationStageList from '../AutomationStageList';
import AutomationToolbar from '../AutomationToolbar';
import StageNode from '../nodes/StageNode';

const flow = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));

vi.mock('@xyflow/react', async () => {
  const React = await import('react');
  const passthrough = ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children);
  return {
    ReactFlow: (props: Record<string, unknown>) => {
      flow.props = props;
      return React.createElement('div', { 'data-testid': 'react-flow' });
    },
    Background: passthrough,
    Controls: passthrough,
    MiniMap: passthrough,
    useReactFlow: () => ({ screenToFlowPosition: (point: { x: number; y: number }) => ({ x: point.x + 10, y: point.y + 20 }) }),
    Handle: () => React.createElement('div'),
    Position: { Left: 'left', Right: 'right' },
  };
});

interface CanvasProps {
  onNodesChange?: (changes: Array<Record<string, unknown>>) => void;
  onEdgesChange?: (changes: Array<Record<string, unknown>>) => void;
  onConnect?: (connection: Record<string, unknown>) => void;
  onDragOver?: (event: Record<string, unknown>) => void;
  onDrop?: (event: Record<string, unknown>) => void;
  onNodeClick?: (event: unknown, node: { id: string }) => void;
  onPaneClick?: () => void;
  ariaLabelConfig?: Record<string, unknown>;
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

function graphDefinition(): AutomationDefinition {
  return createAutomationDefinition('auto-1', 'Pipeline', 1, {
    graph: {
      nodes: [
        createAutomationNode(
          'input-1',
          AUTOMATION_KIND.INPUT,
          { x: 0, y: 0 },
          {
            data: { kind: AUTOMATION_KIND.INPUT, path: '/in.mp4', mediaKind: 'video' },
          },
        ),
        createAutomationNode(
          'stage-1',
          AUTOMATION_KIND.STAGE,
          { x: 1, y: 0 },
          {
            data: { kind: AUTOMATION_KIND.STAGE, name: 'Stage A' },
          },
        ),
        createAutomationNode(
          'op-1',
          AUTOMATION_KIND.TRANSCODE,
          { x: 2, y: 0 },
          {
            data: { kind: AUTOMATION_KIND.TRANSCODE, backend: 'FFMPEG', options: {} },
          },
        ),
        createAutomationNode(
          'output-1',
          AUTOMATION_KIND.OUTPUT,
          { x: 3, y: 0 },
          {
            data: { kind: AUTOMATION_KIND.OUTPUT, path: '/out.mp4' },
          },
        ),
      ],
      edges: [createAutomationEdge('input-1', 'op-1', 'edge-1')],
    },
  });
}

function resetStore(definition: AutomationDefinition | null = graphDefinition()): void {
  useAutomationStore.setState({
    definitions: definition ? [definition] : [],
    activeDefinition: definition,
    selectedNodeId: null,
    validationIssues: [],
    isDirty: false,
    isInitialized: true,
    runs: {},
    runtimeInputPath: null,
    detectedMediaKind: null,
    selectedRunId: null,
    backendStatus: backendStatus(),
  });
}

async function chooseSelect(testId: string, optionName?: string, optionIndex = 0): Promise<void> {
  fireEvent.mouseDown(within(screen.getByTestId(testId)).getByRole('combobox'));
  const options = await screen.findAllByRole('option');
  fireEvent.click(
    optionName ? (options.find((option) => option.textContent === optionName) ?? options[optionIndex]) : options[optionIndex],
  );
}

function inputFor(testId: string): HTMLElement {
  return within(screen.getByTestId(testId)).getByRole('textbox');
}

describe('automation component branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('commits canvas node, edge, connect, drop, click, and accessibility callbacks', () => {
    render(<AutomationCanvas />);
    const props = flow.props as CanvasProps;

    act(() => {
      props.onNodesChange?.([
        { id: 'stage-1', type: 'position', position: { x: 9, y: 8 } },
        { id: 'stage-1', type: 'select', selected: true },
        { id: 'stage-1', type: 'select', selected: false },
        { id: 'op-1', type: 'remove' },
      ]);
      props.onEdgesChange?.([{ id: 'edge-1', type: 'remove' }]);
      props.onConnect?.({ source: undefined, target: 'output-1' });
      props.onConnect?.({ source: 'input-1', target: 'output-1', sourceHandle: 'out', targetHandle: 'in' });
      props.onNodeClick?.(null, { id: 'input-1' });
      props.onPaneClick?.();
    });

    const state = useAutomationStore.getState();
    expect(state.activeDefinition?.graph.nodes.find((node) => node.id === 'stage-1')?.position).toEqual({ x: 9, y: 8 });
    expect(state.selectedNodeId).toBeNull();
    expect(state.activeDefinition?.graph.nodes.some((node) => node.id === 'op-1')).toBe(false);
    expect(state.activeDefinition?.graph.edges.some((edge) => edge.id === 'edge-1')).toBe(false);
    expect(state.activeDefinition?.graph.edges).toHaveLength(1);

    const preventDefault = vi.fn();
    const dropEffect = { value: 'none' };
    act(() => {
      props.onDragOver?.({
        preventDefault,
        dataTransfer: {
          get dropEffect() {
            return dropEffect.value;
          },
          set dropEffect(value: string) {
            dropEffect.value = value;
          },
        },
      });
      props.onDrop?.({
        preventDefault,
        clientX: 4,
        clientY: 6,
        dataTransfer: { getData: () => '' },
      });
      props.onDrop?.({
        preventDefault,
        clientX: 4,
        clientY: 6,
        dataTransfer: { getData: () => AUTOMATION_KIND.CUT },
      });
    });

    expect(preventDefault).toHaveBeenCalledTimes(3);
    expect(dropEffect.value).toBe('move');
    expect(useAutomationStore.getState().activeDefinition?.graph.nodes.at(-1)?.position).toEqual({ x: 14, y: 26 });
    expect(
      (props.ariaLabelConfig?.['node.a11yDescription.ariaLiveMessage'] as (value: unknown) => unknown)({
        direction: 'up',
        x: 1,
        y: 2,
      }),
    ).toBe('automations.canvasNodeMove');
  });

  it('edits inspector fields for input, stage, output, and operation nodes', async () => {
    render(<AutomationInspector />);

    act(() => useAutomationStore.setState({ selectedNodeId: 'input-1' }));
    fireEvent.change(inputFor('automation-node-label'), { target: { value: 'Source' } });
    fireEvent.change(inputFor('automation-input-path'), { target: { value: '/new.mp4' } });
    await chooseSelect('automation-media-kind', 'automations.mediaKind.audio');

    act(() => useAutomationStore.setState({ selectedNodeId: 'stage-1' }));
    fireEvent.change(inputFor('automation-stage-name'), { target: { value: 'Stage B' } });

    act(() => useAutomationStore.setState({ selectedNodeId: 'output-1' }));
    fireEvent.change(inputFor('automation-output-path'), { target: { value: '/final.m4a' } });
    fireEvent.change(inputFor('automation-output-extension'), { target: { value: 'm4a' } });

    const nodes = useAutomationStore.getState().activeDefinition?.graph.nodes ?? [];
    expect(nodes[0]).toMatchObject({ label: 'Source', data: { kind: 'input', path: '/new.mp4', mediaKind: 'audio' } });
    expect(nodes[1].data).toEqual({ kind: 'stage', name: 'Stage B' });
    expect(nodes[3].data).toEqual({ kind: 'output', path: '/final.m4a', extension: 'm4a' });
    expect(nodes.some((node) => node.id === 'op-1')).toBe(true);
  });

  it('edits operation fields and backend selection', async () => {
    const definition = graphDefinition();
    const operation = definition.graph.nodes.find((node) => node.id === 'op-1')!;
    render(<AutomationOperationFields node={operation} defaultBackend="FFMPEG" />);

    await chooseSelect('automation-backend', 'BMF');
    expect(useAutomationStore.getState().activeDefinition?.graph.nodes.find((node) => node.id === 'op-1')?.data).toMatchObject({
      backend: 'BMF',
    });
    const currentData = () => useAutomationStore.getState().activeDefinition?.graph.nodes.find((node) => node.id === 'op-1')?.data;

    fireEvent.change(screen.getByLabelText('automations.fields.videoCodec'), { target: { value: 'h264' } });
    expect(currentData()).toMatchObject({ options: { videoCodec: 'h264' } });
    fireEvent.change(screen.getByLabelText('automations.fields.audioCodec'), { target: { value: 'aac' } });
    expect(currentData()).toMatchObject({ options: { audioCodec: 'aac' } });
    fireEvent.change(screen.getByLabelText('automations.fields.startTime'), { target: { value: '1' } });
    expect(currentData()).toMatchObject({ options: { startTime: '1' } });
    fireEvent.change(screen.getByLabelText('automations.fields.endTime'), { target: { value: '2' } });
    expect(currentData()).toMatchObject({ options: { endTime: '2' } });
    fireEvent.click(screen.getByRole('switch'));
    expect(currentData()).toMatchObject({ options: { copy: true } });
  });

  it('runs library actions and drag-to-add from the palette', async () => {
    const api = window.electronAPI as unknown as Record<string, unknown>;
    (api.automationDuplicate as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (api.automationDelete as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (api.automationExport as ReturnType<typeof vi.fn>).mockResolvedValue('/export.json');
    const onClose = vi.fn();
    render(<AutomationLibraryDrawer open onClose={onClose} />);

    await act(async () => {
      fireEvent.click(screen.getAllByLabelText('automations.duplicate')[0]);
      fireEvent.click(screen.getAllByLabelText('automations.delete')[0]);
      fireEvent.click(screen.getAllByLabelText('automations.exportDefinition')[0]);
      fireEvent.click(screen.getByText('automations.new'));
      fireEvent.click(screen.getByText('automations.save'));
      fireEvent.click(screen.getByText('automations.import'));
      fireEvent.click(screen.getByText('automations.export'));
    });

    expect(onClose).toHaveBeenCalled();
    expect(api.automationSave).toHaveBeenCalled();
    expect(api.automationImport).toHaveBeenCalled();
    expect(api.automationExport).toHaveBeenCalled();
    expect(api.automationDuplicate).toHaveBeenCalled();
    expect(api.automationDelete).toHaveBeenCalled();

    render(<AutomationNodePalette />);
    const setData = vi.fn();
    fireEvent.dragStart(screen.getByTestId('automation-palette-transcode'), {
      dataTransfer: { setData, effectAllowed: 'none' },
    });
    expect(setData).toHaveBeenCalledWith('application/x-encodex-automation-node', 'transcode');
  });

  it('selects, cancels, and edits runtime input in the run panel', async () => {
    const definition = graphDefinition();
    const running = {
      runId: 'run-1',
      status: AUTOMATION_RUN_STATUS.RUNNING,
      progress: 20,
      automationId: 'auto-1',
      automationName: 'Pipeline',
      startedAt: 1,
      updatedAt: 2,
      nodeStatuses: {},
      stageStatuses: { 'stage-1': AUTOMATION_RUN_STATUS.RUNNING, 'ghost-stage': AUTOMATION_RUN_STATUS.QUEUED },
      events: [],
    };
    useAutomationStore.setState({
      activeDefinition: definition,
      runs: {
        'run-1': running,
        'run-2': { ...running, runId: 'run-2', startedAt: 0, updatedAt: 1 },
      },
      selectedRunId: 'run-1',
    });
    const onCancel = vi.fn();
    render(<AutomationRunPanel onCancel={onCancel} onRerun={vi.fn()} onProbeInput={vi.fn()} onSelectRuntimeInput={vi.fn()} />);

    await chooseSelect('automation-run-history', undefined, 1);
    fireEvent.click(screen.getByTestId('automation-cancel-run-panel'));
    fireEvent.change(inputFor('automation-runtime-input'), { target: { value: '/runtime.mp4' } });

    expect(onCancel).toHaveBeenCalledWith(expect.any(String));
    expect(useAutomationStore.getState().runtimeInputPath).toBe('/runtime.mp4');
    expect(screen.getByTestId('automation-stage-ghost-stage')).toBeTruthy();
  });

  it('adds, renames, and focuses stages', () => {
    render(<AutomationStageList />);
    fireEvent.click(screen.getByTestId('automation-add-stage'));
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'Renamed stage' } });
    fireEvent.focus(inputs[0]);

    const state = useAutomationStore.getState();
    expect(state.activeDefinition?.graph.nodes.filter((node) => node.kind === AUTOMATION_KIND.STAGE)).toHaveLength(2);
    expect(state.activeDefinition?.graph.nodes[1].data).toEqual({ kind: 'stage', name: 'Renamed stage' });
    expect(state.selectedNodeId).toBe('stage-1');
  });

  it('renames an automation from the toolbar', () => {
    const onRename = vi.fn();
    render(
      <AutomationToolbar
        name="Pipeline"
        issueCount={0}
        isDirty={false}
        hasDefinition
        onRename={onRename}
        onNew={vi.fn()}
        onOpenLibrary={vi.fn()}
        onSave={vi.fn()}
        onSaveAs={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onImport={vi.fn()}
        onExport={vi.fn()}
        onSelectInput={vi.fn()}
        onRun={vi.fn()}
        isRunning={false}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId('automation-name-input'), { target: { value: 'Renamed' } });
    expect(onRename).toHaveBeenCalledWith('Renamed');
  });

  it('renders a selected stage node with issue badge', () => {
    render(
      <StageNode
        {...({
          id: 'stage-1',
          selected: true,
          data: {
            automationNode: createAutomationNode('stage-1', 'stage', { x: 0, y: 0 }),
            label: 'Stage A',
            status: AUTOMATION_RUN_STATUS.RUNNING,
            issueCodes: ['cycle'],
          },
        } as unknown as ComponentProps<typeof StageNode>)}
      />,
    );
    expect(screen.getByTestId('automation-canvas-node-stage-1').textContent).toContain('Stage A');
  });

  it('renders an unselected stage node with default status and no issues', () => {
    render(
      <StageNode
        {...({
          id: 'stage-2',
          selected: false,
          data: {
            automationNode: createAutomationNode('stage-2', 'stage', { x: 0, y: 0 }),
            label: 'Stage B',
            issueCodes: [],
          },
        } as unknown as ComponentProps<typeof StageNode>)}
      />,
    );
    expect(screen.getByTestId('automation-canvas-node-stage-2').textContent).toContain('automations.status.queued');
  });
});
