import { describe, it, expect } from 'vitest';
import {
  automationDefinitionSchema,
  automationExportSchema,
  automationStoreSchema,
  isAutomationDefinition,
  parseAutomationDefinition,
  parseAutomationExport,
  parseAutomationStore,
} from '../schema';
import { createAutomationDefinition, createAutomationNode } from '../defaults';

function validDefinition() {
  return createAutomationDefinition('id', 'Name', 1, {
    graph: {
      nodes: [createAutomationNode('input-1', 'input', { x: 0, y: 0 }, { data: { kind: 'input', path: 'C:/a.mp4' } })],
      edges: [],
    },
  });
}

describe('automation schemas', () => {
  it('parses a valid definition', () => {
    const definition = validDefinition();
    expect(parseAutomationDefinition(definition)).toEqual(definition);
    expect(isAutomationDefinition(definition)).toBe(true);
  });

  it('rejects an unsupported version', () => {
    expect(() => parseAutomationDefinition({ ...validDefinition(), version: 2 })).toThrow();
    expect(isAutomationDefinition({ ...validDefinition(), version: 2 })).toBe(false);
  });

  it('validates persisted store envelopes', () => {
    const store = { version: 1, automations: [validDefinition()] };
    expect(parseAutomationStore(store)).toEqual(store);
    expect(() => automationStoreSchema.parse({ version: 2, automations: [] })).toThrow();
  });

  it('validates portable export envelopes', () => {
    const exported = { format: 'automation', version: 1, exportedAt: 5, automation: validDefinition() };
    expect(parseAutomationExport(exported)).toEqual(exported);
    expect(() => automationExportSchema.parse({ ...exported, format: 'other' })).toThrow();
  });

  it('rejects malformed node data', () => {
    const definition = validDefinition();
    definition.graph.nodes[0].data = { kind: 'input' };
    expect(automationDefinitionSchema.safeParse(definition).success).toBe(true);
    definition.graph.nodes[0].data = { kind: 'unknown' } as never;
    expect(automationDefinitionSchema.safeParse(definition).success).toBe(false);
  });
});
