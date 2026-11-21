/** React Flow canvas for the Automations graph editor. */

import { useCallback, useMemo } from 'react';
import type { DragEvent } from 'react';
import { Background, Controls, MiniMap, ReactFlow, useReactFlow } from '@xyflow/react';
import type { Edge, NodeTypes, OnConnect, OnEdgesChange, OnNodesChange } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { CanvasSurface } from '../../styles/Automations.styles';
import { currentAutomationRun, useAutomationStore } from '../../stores/automationStore';
import type { AutomationNodeKind } from '../../../shared/automations/types';
import { newAutomationNodeId } from '../../../shared/automations/defaults';
import type { AutomationFlowNode } from './AutomationNode.types';
import { AUTOMATION_DND_MIME } from './AutomationNode.types';
import InputNode from './nodes/InputNode';
import StageNode from './nodes/StageNode';
import OperationNode from './nodes/OperationNode';
import OutputNode from './nodes/OutputNode';

/** Custom node renderer registry. @const {NodeTypes} */
const nodeTypes: NodeTypes = {
  input: InputNode,
  stage: StageNode,
  transcode: OperationNode,
  extractAudio: OperationNode,
  cut: OperationNode,
  remux: OperationNode,
  demux: OperationNode,
  compressImage: OperationNode,
  output: OutputNode,
};

/** Renders the visual graph and commits user edits to the automation store. */
export default function AutomationCanvas() {
  const { t } = useTranslation();
  const { screenToFlowPosition } = useReactFlow();
  const activeDefinition = useAutomationStore((state) => state.activeDefinition);
  const selectedNodeId = useAutomationStore((state) => state.selectedNodeId);
  const validationIssues = useAutomationStore((state) => state.validationIssues);
  const currentRun = useAutomationStore(currentAutomationRun);
  const updateNode = useAutomationStore((state) => state.updateNode);
  const removeNode = useAutomationStore((state) => state.removeNode);
  const selectNode = useAutomationStore((state) => state.selectNode);
  const addEdge = useAutomationStore((state) => state.addEdge);
  const removeEdge = useAutomationStore((state) => state.removeEdge);
  const addNode = useAutomationStore((state) => state.addNode);

  const nodes = useMemo<AutomationFlowNode[]>(() => {
    if (!activeDefinition) return [];
    return activeDefinition.graph.nodes.map((automationNode) => ({
      id: automationNode.id,
      type: automationNode.kind,
      position: automationNode.position,
      selected: automationNode.id === selectedNodeId,
      data: {
        automationNode,
        label: automationNode.label,
        status:
          automationNode.kind === 'stage'
            ? (currentRun?.stageStatuses[automationNode.id] ?? currentRun?.nodeStatuses[automationNode.id])
            : currentRun?.nodeStatuses[automationNode.id],
        issueCodes: validationIssues.filter((issue) => issue.nodeId === automationNode.id).map((issue) => issue.code),
      },
    }));
  }, [activeDefinition, currentRun, selectedNodeId, validationIssues]);

  const edges = useMemo<Edge[]>(() => activeDefinition?.graph.edges ?? [], [activeDefinition]);

  const onNodesChange = useCallback<OnNodesChange<AutomationFlowNode>>(
    (changes) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          updateNode(change.id, { position: change.position });
        } else if (change.type === 'remove') {
          removeNode(change.id);
        } else if (change.type === 'select') {
          if (change.selected) selectNode(change.id);
        }
      }
    },
    [removeNode, selectNode, updateNode],
  );

  const onEdgesChange = useCallback<OnEdgesChange>(
    (changes) => {
      for (const change of changes) {
        if (change.type === 'remove') removeEdge(change.id);
      }
    },
    [removeEdge],
  );

  const onConnect = useCallback<OnConnect>(
    (connection) => {
      if (!connection.source || !connection.target) return;
      addEdge({
        id: newAutomationNodeId(),
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
      });
    },
    [addEdge],
  );

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData(AUTOMATION_DND_MIME);
      if (!kind) return;
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(kind as AutomationNodeKind, position);
    },
    [addNode, screenToFlowPosition],
  );

  return (
    <CanvasSurface>
      <ReactFlow<AutomationFlowNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
        onDragOver={onDragOver}
        onDrop={onDrop}
        fitView
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
        aria-label={t('automations.canvasLabel')}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </CanvasSurface>
  );
}
