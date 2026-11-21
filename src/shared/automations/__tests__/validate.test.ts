import { describe, it, expect } from 'vitest';
import { validateAutomation, isValidAutomation, topologicalNodeOrder } from '../validate';
import { createAutomationDefinition, createAutomationEdge, createAutomationNode } from '../defaults';
import type { AutomationDefinition } from '../types';

function validDefinition(): AutomationDefinition {
  return createAutomationDefinition('auto-1', 'Demo', 1, {
    graph: {
      nodes: [
        createAutomationNode('input-1', 'input', { x: 0, y: 0 }, { data: { kind: 'input', path: 'C:/source.mp4' } }),
        createAutomationNode('op-1', 'transcode', { x: 1, y: 0 }, { data: { kind: 'transcode', options: { videoCodec: 'libx264' } } }),
        createAutomationNode('output-1', 'output', { x: 2, y: 0 }, { data: { kind: 'output', path: 'C:/out.mp4' } }),
      ],
      edges: [createAutomationEdge('input-1', 'op-1'), createAutomationEdge('op-1', 'output-1')],
    },
  });
}

describe('validateAutomation', () => {
  it('accepts a valid definition', () => {
    expect(validateAutomation(validDefinition())).toEqual([]);
    expect(isValidAutomation(validDefinition())).toBe(true);
  });

  it('reports empty graph, missing input, and missing output', () => {
    const codes = validateAutomation(createAutomationDefinition('id', 'Empty', 1)).map((issue) => issue.code);
    expect(codes).toEqual(['empty_graph', 'missing_input', 'missing_output']);
  });

  it('accepts runtime input/output overrides instead of nodes', () => {
    const definition = validDefinition();
    definition.graph.nodes = definition.graph.nodes.filter((node) => node.kind === 'transcode');
    definition.graph.edges = [];
    expect(validateAutomation(definition, { inputPath: 'C:/src.mp4', outputPath: 'C:/dst.mp4' })).toEqual([]);
  });

  it('detects duplicate node ids and invalid kinds', () => {
    const definition = validDefinition();
    definition.graph.nodes.push({ ...definition.graph.nodes[1], id: 'op-1' });
    const codes = validateAutomation(definition).map((issue) => issue.code);
    expect(codes).toContain('duplicate_node_id');
  });

  it('detects stage references that do not exist', () => {
    const definition = validDefinition();
    definition.graph.nodes[1].stageId = 'missing-stage';
    const issues = validateAutomation(definition);
    expect(issues.map((issue) => issue.code)).toContain('invalid_stage_reference');
    expect(issues.find((issue) => issue.code === 'invalid_stage_reference')?.stageId).toBe('missing-stage');
  });

  it('detects cycles using dependency ids', () => {
    const definition = validDefinition();
    definition.graph.nodes.push(createAutomationNode('op-2', 'cut', { x: 2, y: 1 }, { data: { kind: 'cut', options: {} } }));
    definition.graph.edges = [
      createAutomationEdge('input-1', 'op-1'),
      createAutomationEdge('op-1', 'op-2'),
      createAutomationEdge('op-2', 'op-1'),
      createAutomationEdge('op-2', 'output-1'),
    ];
    expect(validateAutomation(definition).map((issue) => issue.code)).toContain('cycle');
    expect(topologicalNodeOrder(definition)).toHaveLength(1);
  });

  it('detects a disconnected executable node', () => {
    const definition = validDefinition();
    definition.graph.nodes.push(createAutomationNode('loose', 'remux', { x: 9, y: 9 }, { data: { kind: 'remux', options: {} } }));
    expect(validateAutomation(definition).map((issue) => issue.code)).toContain('disconnected_node');
  });

  it('rejects unavailable backends from runtime', () => {
    const definition = validDefinition();
    definition.graph.nodes[1].data = { kind: 'transcode', backend: 'BMF', options: {} };
    expect(validateAutomation(definition, { availableBackends: ['FFMPEG'] }).map((issue) => issue.code)).toContain('backend_unavailable');
  });

  it('rejects unsupported media kinds at runtime', () => {
    const definition = validDefinition();
    definition.graph.nodes[1] = createAutomationNode(
      'op-1',
      'compressImage',
      { x: 1, y: 0 },
      {
        data: { kind: 'compressImage', options: {} },
      },
    );
    expect(validateAutomation(definition, { mediaKind: 'audio' }).map((issue) => issue.code)).toContain(
      'unsupported_operation_for_media_kind',
    );
  });

  it('rejects invalid references and unsafe output templates', () => {
    const definition = validDefinition();
    definition.graph.nodes[1].data = {
      kind: 'transcode',
      options: { videoFilters: ['{{missing.bad}}'] },
      outputTemplate: 'C:/bad?name.mp4',
    };
    const codes = validateAutomation(definition).map((issue) => issue.code);
    expect(codes).toContain('invalid_reference');
    expect(codes).toContain('invalid_output_path_template');
  });

  it('requires an output path', () => {
    const definition = validDefinition();
    definition.graph.nodes[2].data = { kind: 'output', path: '' };
    expect(validateAutomation(definition).map((issue) => issue.code)).toContain('missing_required_option');
  });
});
