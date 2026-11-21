import { describe, it, expect } from 'vitest';
import { compileAutomation, automationTempPath } from '../compile';
import { resolveAutomationReferences, automationReferences, isValidAutomationId } from '../references';
import { createAutomationDefinition, createAutomationEdge, createAutomationNode } from '../defaults';
import type { AutomationDefinition } from '../types';

function twoStageDefinition(): AutomationDefinition {
  return createAutomationDefinition('auto-1', 'Two stage', 1, {
    graph: {
      nodes: [
        createAutomationNode('input-1', 'input', { x: 0, y: 0 }, { data: { kind: 'input', path: 'C:/source.mov' } }),
        createAutomationNode('stage-1', 'stage', { x: 1, y: 0 }, { stageId: 'stage-1', data: { kind: 'stage', name: 'Normalize' } }),
        createAutomationNode(
          'op-1',
          'transcode',
          { x: 2, y: 0 },
          { stageId: 'stage-1', data: { kind: 'transcode', options: { videoCodec: 'libx264' } } },
        ),
        createAutomationNode('stage-2', 'stage', { x: 3, y: 0 }, { stageId: 'stage-2', data: { kind: 'stage', name: 'Deliver' } }),
        createAutomationNode(
          'op-2',
          'extractAudio',
          { x: 4, y: 0 },
          { stageId: 'stage-2', data: { kind: 'extractAudio', options: { audioCodec: 'aac' } } },
        ),
        createAutomationNode('output-1', 'output', { x: 5, y: 0 }, { data: { kind: 'output', path: 'C:/final.m4a' } }),
      ],
      edges: [createAutomationEdge('input-1', 'op-1'), createAutomationEdge('op-1', 'op-2'), createAutomationEdge('op-2', 'output-1')],
    },
  });
}

describe('compileAutomation', () => {
  it('produces a deterministic topological plan with temp intermediates and a final output', () => {
    const runtime = { tempRoot: 'C:/tmp/automations' };
    const plan = compileAutomation(twoStageDefinition(), runtime);
    expect(plan.valid).toBe(true);
    expect(plan.issues).toEqual([]);
    expect(plan.steps.map((step) => step.nodeId)).toEqual(['op-1', 'op-2']);
    expect(plan.steps.map((step) => step.stageId)).toEqual(['stage-1', 'stage-2']);
    expect(plan.steps[0].outputPath).toBe('C:/tmp/automations/step-000-op-1.bin');
    expect(plan.steps[1].outputPath).toBe('C:/final.m4a');
    expect(plan.inputPath).toBe('C:/source.mov');
    expect(plan.summary).toContain('transcode -> extractAudio');
  });

  it('uses runtime input/output overrides and references', () => {
    const plan = compileAutomation(twoStageDefinition(), { inputPath: 'C:/override.mov', outputPath: 'C:/override.m4a' });
    expect(plan.inputPath).toBe('C:/override.mov');
    expect(plan.outputPath).toBe('C:/override.m4a');
    expect(plan.steps[1].outputPath).toBe('C:/override.m4a');
  });

  it('resolves placeholder references from earlier steps', () => {
    const definition = twoStageDefinition();
    definition.graph.nodes[4].data = {
      kind: 'extractAudio',
      options: { videoFilters: ['{{op-1.output}}'] },
    };
    const plan = compileAutomation(definition, { tempRoot: 'tmp' });
    expect(plan.steps[1].options.videoFilters).toEqual(['tmp/step-000-op-1.bin']);
  });

  it('returns no steps when validation fails', () => {
    const definition = createAutomationDefinition('id', 'Bad', 1);
    const plan = compileAutomation(definition);
    expect(plan.valid).toBe(false);
    expect(plan.steps).toEqual([]);
    expect(plan.issues.map((issue) => issue.code)).toContain('empty_graph');
  });

  it('builds deterministic temp paths', () => {
    expect(automationTempPath({ tempRoot: 'tmp/' }, 'node-1', 2)).toBe('tmp/step-002-node-1.bin');
    expect(automationTempPath({}, 'node-1', 0)).toBe('automations/step-000-node-1.bin');
  });
});

describe('automation references', () => {
  it('validates ids and extracts de-duplicated references', () => {
    expect(isValidAutomationId('op-1')).toBe(true);
    expect(isValidAutomationId('1op')).toBe(false);
    const refs = automationReferences({ a: '{{op-1.output}}', b: ['{{op-1.mediaInfo.duration}}'] });
    expect(refs.map((ref) => `${ref.nodeId}.${ref.path}`)).toEqual(['op-1.output', 'op-1.mediaInfo.duration']);
  });

  it('resolves nested placeholder values and preserves unknown ones', () => {
    expect(resolveAutomationReferences({ path: '{{op-1.output}}' }, { 'op-1': { output: 'C:/a.mp4' } })).toEqual({
      path: 'C:/a.mp4',
    });
    expect(resolveAutomationReferences('{{missing.output}}', {})).toBe('{{missing.output}}');
  });
});
