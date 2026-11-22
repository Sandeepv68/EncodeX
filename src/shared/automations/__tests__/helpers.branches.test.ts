import { describe, expect, it } from 'vitest';
import { isBoundedAutomationJsonValue } from '../limits';
import { automationOperationSupportsMedia, isExecutableAutomationNodeKind } from '../node-kinds';
import { automationReferences, isValidAutomationId, resolveAutomationReferences } from '../references';
import { validateAutomation } from '../validate';
import { createAutomationDefinition, createAutomationEdge, createAutomationNode } from '../defaults';
import type { AutomationDefinition, AutomationNodeData } from '../types';

function definition(): AutomationDefinition {
  return createAutomationDefinition('auto-1', 'Demo', 1, {
    graph: {
      nodes: [
        createAutomationNode('input-1', 'input', { x: 0, y: 0 }, { data: { kind: 'input', path: 'C:/in.mp4' } }),
        createAutomationNode('op-1', 'transcode', { x: 1, y: 0 }, { data: { kind: 'transcode', options: {} } }),
        createAutomationNode('output-1', 'output', { x: 2, y: 0 }, { data: { kind: 'output', path: 'C:/out.mp4' } }),
      ],
      edges: [createAutomationEdge('input-1', 'op-1'), createAutomationEdge('op-1', 'output-1')],
    },
  });
}

describe('automation helper branches', () => {
  it('rejects non-objects, oversized structures, hostile keys, and exotic objects', () => {
    expect(isBoundedAutomationJsonValue(() => undefined)).toBe(false);
    expect(isBoundedAutomationJsonValue(Array.from({ length: 500 }, () => Array.from({ length: 21 }, () => [])))).toBe(false);
    expect(isBoundedAutomationJsonValue(new Array(501).fill(1))).toBe(false);
    expect(isBoundedAutomationJsonValue(new Date())).toBe(false);

    const getterObject = Object.defineProperty({}, 'value', { get: () => 1, enumerable: true });
    expect(isBoundedAutomationJsonValue(getterObject)).toBe(false);

    const keysThrow = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('blocked');
        },
      },
    );
    expect(isBoundedAutomationJsonValue(keysThrow)).toBe(false);

    const prototypeThrows = new Proxy(
      {},
      {
        getPrototypeOf: () => {
          throw new Error('blocked');
        },
      },
    );
    expect(isBoundedAutomationJsonValue(prototypeThrows)).toBe(false);
  });

  it('reports capability differences for executable and non-executable kinds', () => {
    expect(isExecutableAutomationNodeKind('stage')).toBe(false);
    expect(automationOperationSupportsMedia('stage', 'video')).toBe(false);
    expect(automationOperationSupportsMedia('transcode', 'video')).toBe(true);
  });

  it('collects references from nested objects and deduplicates repeated tokens', () => {
    const references = automationReferences({
      nested: { first: '{{op.output}}' },
      list: ['{{op.output}}', '{{other.mediaInfo.streams.0.codec_name}}'],
    });
    expect(references).toEqual([
      { field: 'nested', nodeId: 'op', path: 'output' },
      { field: 'list', nodeId: 'op', path: 'output' },
      { field: 'list', nodeId: 'other', path: 'mediaInfo.streams.0.codec_name' },
    ]);
    expect(isValidAutomationId('1bad')).toBe(false);
    expect(resolveAutomationReferences(42, {})).toBe(42);
    expect(resolveAutomationReferences('{{op.output.deep}}', { op: { output: 'scalar' } })).toBe('{{op.output.deep}}');
  });

  it('reports invalid node ids, kinds, self-dependencies, and unsafe paths', () => {
    const invalid = definition();
    invalid.graph.nodes.push(createAutomationNode('1bad', 'bogus' as never, { x: 9, y: 9 }));
    invalid.graph.nodes.push(createAutomationNode('bad-kind', 'bogus' as never, { x: 10, y: 9 }));
    invalid.graph.nodes[1].data = { kind: 'transcode', options: { source: '{{op-1.output}}' } } as unknown as AutomationNodeData;
    invalid.graph.nodes[2].data = { kind: 'output', path: 'C:/bad:name.mp4' };

    const codes = validateAutomation(invalid).map((issue) => issue.code);
    expect(codes).toContain('invalid_node_kind');
    expect(codes).toContain('self_dependency');
    expect(codes).toContain('invalid_output_path_template');
  });

  it('skips invalid reference ids supplied by a hostile matchAll iterator', () => {
    const original = RegExp.prototype[Symbol.matchAll];
    RegExp.prototype[Symbol.matchAll] = function* () {
      yield { 1: '1bad', 2: 'output' } as unknown as RegExpMatchArray;
    } as never;
    try {
      const invalid = definition();
      invalid.graph.nodes[1].data = { kind: 'transcode', options: { source: 'ignored' } } as unknown as AutomationNodeData;
      expect(() => validateAutomation(invalid)).not.toThrow();
    } finally {
      RegExp.prototype[Symbol.matchAll] = original;
    }
  });
});
