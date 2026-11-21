import { describe, it, expect } from 'vitest';
import { createAutomationDefinition, createAutomationEdge, createAutomationNode, createAutomationSettings } from '../defaults';
import { isExecutableAutomationNodeKind, automationOperationSupportsMedia } from '../node-kinds';
import type { AutomationDefinition } from '../types';

function makeValidDefinition(): AutomationDefinition {
  return createAutomationDefinition('auto-1', 'Demo', 1, {
    graph: {
      nodes: [
        createAutomationNode('input-1', 'input', { x: 0, y: 0 }, { data: { kind: 'input', path: 'C:/source.mp4' } }),
        createAutomationNode('stage-1', 'stage', { x: 1, y: 0 }, { data: { kind: 'stage', name: 'Normalize' } }),
        createAutomationNode(
          'op-1',
          'transcode',
          { x: 2, y: 0 },
          { stageId: 'stage-1', data: { kind: 'transcode', options: { videoCodec: 'libx264' } } },
        ),
        createAutomationNode('output-1', 'output', { x: 3, y: 0 }, { data: { kind: 'output', path: 'C:/out.mp4' } }),
      ],
      edges: [createAutomationEdge('input-1', 'op-1'), createAutomationEdge('op-1', 'output-1')],
    },
  });
}

describe('automation defaults and node kinds', () => {
  it('creates independent default settings', () => {
    const first = createAutomationSettings();
    const second = createAutomationSettings({ defaultBackend: 'BMF' });
    expect(first.defaultBackend).toBe('FFMPEG');
    expect(second.defaultBackend).toBe('BMF');
    expect(first).not.toBe(second);
  });

  it('creates a valid empty definition', () => {
    const definition = createAutomationDefinition('id', 'Name', 42);
    expect(definition).toMatchObject({ version: 1, createdAt: 42, updatedAt: 42 });
    expect(definition.graph).toEqual({ nodes: [], edges: [] });
  });

  it('identifies executable nodes and media compatibility', () => {
    expect(isExecutableAutomationNodeKind('transcode')).toBe(true);
    expect(isExecutableAutomationNodeKind('input')).toBe(false);
    expect(automationOperationSupportsMedia('compressImage', 'image')).toBe(true);
    expect(automationOperationSupportsMedia('extractAudio', 'image')).toBe(false);
  });

  it('builds a fully connected valid definition fixture', () => {
    expect(makeValidDefinition().graph.nodes).toHaveLength(4);
  });
});
