/**
 * @fileoverview Unit tests for the typed workflow DAG planner.
 */

import { describe, it, expect } from 'vitest';
import {
  planWorkflow,
  resolveReferences,
  stepReferences,
  topologicalOrder,
  validateWorkflow,
  WORKFLOW_TOOLS,
  type Workflow,
} from '../workflow';

describe('stepReferences', () => {
  it('finds references in strings, arrays and nested objects', () => {
    const refs = stepReferences({
      input: '{{a.output}}',
      filters: ['scale=1280:-2', '{{b.jobId}}'],
      extra: { nested: '{{c.output}}' },
    });
    expect(refs).toEqual([
      { arg: 'input', stepId: 'a', field: 'output' },
      { arg: 'filters', stepId: 'b', field: 'jobId' },
      { arg: 'extra', stepId: 'c', field: 'output' },
    ]);
  });

  it('de-duplicates repeated references in the same argument', () => {
    expect(stepReferences({ tags: ['{{x.output}}', '{{x.output}}'] })).toHaveLength(1);
  });

  it('returns nothing for plain values', () => {
    expect(stepReferences({ input: '/tmp/a.mp4', quality: 23 })).toEqual([]);
  });
});

describe('validateWorkflow', () => {
  it('rejects an empty workflow', () => {
    const issues = validateWorkflow({ steps: [] });
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('empty_workflow');
  });

  it('rejects duplicate and invalid step ids', () => {
    const issues = validateWorkflow({
      steps: [
        { id: 'a', tool: 'cut_video' },
        { id: 'a', tool: 'cut_video' },
        { id: '1bad', tool: 'cut_video' },
      ],
    });
    expect(issues.map((issue) => issue.code)).toEqual(['duplicate_step_id', 'invalid_step_id']);
  });

  it('rejects unsupported tools', () => {
    const issues = validateWorkflow({ steps: [{ id: 'a', tool: 'definitely_not_a_tool' as never }] });
    expect(issues[0].code).toBe('unknown_tool');
  });

  it('rejects unknown explicit and referenced dependencies', () => {
    const issues = validateWorkflow({
      steps: [
        { id: 'a', tool: 'cut_video', dependsOn: ['ghost'] },
        { id: 'b', tool: 'convert_media', args: { input: '{{missing.output}}' } },
      ],
    });
    expect(issues.map((issue) => issue.code)).toEqual(['unknown_dependency', 'unknown_dependency']);
    expect(issues[0].stepId).toBe('a');
    expect(issues[1].stepId).toBe('b');
  });

  it('rejects a self dependency', () => {
    const issues = validateWorkflow({ steps: [{ id: 'a', tool: 'cut_video', dependsOn: ['a'] }] });
    expect(issues[0].code).toBe('self_dependency');
  });

  it('rejects a cycle', () => {
    const issues = validateWorkflow({
      steps: [
        { id: 'a', tool: 'cut_video', args: { input: '{{b.output}}' } },
        { id: 'b', tool: 'convert_media', args: { input: '{{a.output}}' } },
      ],
    });
    expect(issues.map((issue) => issue.code)).toEqual(['cycle']);
  });

  it('accepts every supported tool', () => {
    const steps = WORKFLOW_TOOLS.map((tool, index) => ({ id: `s${index}`, tool }));
    expect(validateWorkflow({ steps })).toEqual([]);
  });
});

describe('topologicalOrder', () => {
  it('orders dependencies before dependents, stable on input order', () => {
    const steps = [
      { id: 'c', tool: 'remux_media' as const, dependsOn: ['b'] },
      { id: 'a', tool: 'cut_video' as const },
      { id: 'b', tool: 'convert_media' as const, dependsOn: ['a'] },
    ];
    expect(topologicalOrder(steps)).toEqual(['a', 'b', 'c']);
  });

  it('infers dependencies from references', () => {
    const steps = [
      { id: 'b', tool: 'convert_media' as const, args: { input: '{{a.output}}' } },
      { id: 'a', tool: 'cut_video' as const },
    ];
    expect(topologicalOrder(steps)).toEqual(['a', 'b']);
  });

  it('returns a partial order when a cycle blocks completion', () => {
    const steps = [
      { id: 'a', tool: 'cut_video' as const, dependsOn: ['b'] },
      { id: 'b', tool: 'convert_media' as const, dependsOn: ['a'] },
    ];
    expect(topologicalOrder(steps)).toEqual([]);
  });
});

describe('planWorkflow', () => {
  it('plans a valid linear chain', () => {
    const workflow: Workflow = {
      steps: [
        { id: 'cut', tool: 'cut_video', args: { input: '/in.mp4', startTime: '0', duration: '10' } },
        { id: 'convert', tool: 'convert_media', args: { input: '{{cut.output}}', videoCodec: 'libx264' } },
      ],
    };
    const plan = planWorkflow(workflow);
    expect(plan.valid).toBe(true);
    expect(plan.order).toEqual(['cut', 'convert']);
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].order).toBe(0);
    expect(plan.steps[1].dependsOn).toEqual(['cut']);
    expect(plan.steps[1].references).toEqual([{ arg: 'input', stepId: 'cut', field: 'output' }]);
    expect(plan.summary).toBe('2 steps: cut_video -> convert_media');
  });

  it('marks an invalid workflow with no order and keeps issues', () => {
    const plan = planWorkflow({ steps: [{ id: 'a', tool: 'cut_video', dependsOn: ['nope'] }] });
    expect(plan.valid).toBe(false);
    expect(plan.order).toEqual([]);
    expect(plan.steps).toEqual([]);
    expect(plan.issues[0].code).toBe('unknown_dependency');
  });

  it('summarizes a single step', () => {
    expect(planWorkflow({ steps: [{ id: 'a', tool: 'cut_video' }] }).summary).toBe('1 step: cut_video');
  });
});

describe('resolveReferences', () => {
  it('substitutes step results into scalars, arrays and objects', () => {
    const context = { cut: { output: '/tmp/cut.mp4', jobId: 'job-1' } };
    const resolved = resolveReferences(
      { input: '{{cut.output}}', id: '{{cut.jobId}}', tags: ['x', '{{cut.output}}'], nested: { at: '{{cut.output}}' } },
      context,
    );
    expect(resolved).toEqual({
      input: '/tmp/cut.mp4',
      id: 'job-1',
      tags: ['x', '/tmp/cut.mp4'],
      nested: { at: '/tmp/cut.mp4' },
    });
  });

  it('reads dot-path fields', () => {
    const context = { a: { meta: { size: 42 } } };
    expect(resolveReferences('{{a.meta.size}}', context)).toBe('42');
  });

  it('leaves unresolved references untouched', () => {
    expect(resolveReferences('{{ghost.output}}', {})).toBe('{{ghost.output}}');
    expect(resolveReferences('{{a.missing}}', { a: { output: 'x' } })).toBe('{{a.missing}}');
  });

  it('passes through non-string values', () => {
    expect(resolveReferences(23, {})).toBe(23);
    expect(resolveReferences(null, {})).toBeNull();
  });
});
