import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { expectAppLog } from '../../../test-utils/crash-tripwire';
import { createAutomationDefinition, createAutomationEdge, createAutomationNode } from '../../../shared/automations/defaults';
import { AUTOMATION_LIMITS, AUTOMATION_STORE } from '../../../shared/automations/limits';
import { AutomationStore } from '../store';

function connectedDefinition(): ReturnType<typeof createAutomationDefinition> {
  return createAutomationDefinition('a', 'Graph', 1000, {
    graph: {
      nodes: [
        createAutomationNode('n1', 'input', { x: 0, y: 0 }, { data: { kind: 'input', path: '/in.mp4' } }),
        createAutomationNode('n2', 'output', { x: 1, y: 0 }, { data: { kind: 'output', path: '/out.mp4' } }),
      ],
      edges: [createAutomationEdge('n1', 'n2')],
    },
  });
}

function oversizedDefinition(): ReturnType<typeof createAutomationDefinition> {
  const options = () =>
    Object.fromEntries(
      Array.from({ length: AUTOMATION_LIMITS.maxOptionsKeys }, (_, index) => [
        `key-${index}`,
        'x'.repeat(AUTOMATION_LIMITS.maxStringLength),
      ]),
    );
  return createAutomationDefinition('huge', 'Huge', 1000, {
    graph: {
      nodes: [
        createAutomationNode('op-1', 'transcode', { x: 0, y: 0 }, { data: { kind: 'transcode', options: options() } }),
        createAutomationNode('op-2', 'transcode', { x: 1, y: 0 }, { data: { kind: 'transcode', options: options() } }),
        createAutomationNode('op-3', 'transcode', { x: 2, y: 0 }, { data: { kind: 'transcode', options: options() } }),
      ],
      edges: [],
    },
  });
}

describe('automation store branch coverage', () => {
  let userDataDir: string;
  let definitionsPath: string;
  let backupPath: string;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'encodex-automation-store-branches-'));
    definitionsPath = join(userDataDir, AUTOMATION_STORE.directory, AUTOMATION_STORE.filename);
    backupPath = `${definitionsPath}${AUTOMATION_STORE.backupSuffix}`;
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  it('deep clones graph and settings payloads when duplicating', () => {
    const store = new AutomationStore(userDataDir);
    const source = store.save(connectedDefinition());

    const copy = store.duplicate({ id: source.id });

    expect(copy).not.toBeNull();
    expect(copy?.graph.nodes).not.toBe(source.graph.nodes);
    expect(copy?.graph.nodes[0]).not.toBe(source.graph.nodes[0]);
    expect(copy?.graph.nodes[0].position).not.toBe(source.graph.nodes[0].position);
    expect(copy?.graph.nodes[0].data).not.toBe(source.graph.nodes[0].data);
    expect(copy?.graph.edges).not.toBe(source.graph.edges);
    expect(copy?.graph.edges[0]).not.toBe(source.graph.edges[0]);
    expect(copy?.settings).not.toBe(source.settings);
  });

  it('warns when backup recovery cannot replace an invalid primary snapshot', () => {
    const definition = createAutomationDefinition('a', 'Recovered', 1000);
    mkdirSync(join(userDataDir, AUTOMATION_STORE.directory), { recursive: true });
    mkdirSync(definitionsPath);
    writeFileSync(backupPath, JSON.stringify({ version: 1, automations: [definition] }), 'utf8');

    expectAppLog('warn', 'main/automations/store');
    expectAppLog('warn', 'main/automations/store');

    expect(new AutomationStore(userDataDir).list()).toEqual([definition]);
  });

  it('rejects a store whose serialized size exceeds the character limit', () => {
    const store = new AutomationStore(userDataDir);
    expect(() => store.save(oversizedDefinition())).toThrow();
  });
});
