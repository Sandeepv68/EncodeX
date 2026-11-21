import { describe, expect, it } from 'vitest';
import { createAutomationDefinition } from '../defaults';
import { AUTOMATION_LIMITS, isBoundedAutomationJsonValue } from '../limits';
import {
  isAutomationDefinition,
  parseAutomationCancelRequest,
  parseAutomationDefinition,
  parseAutomationDuplicateRequest,
  parseAutomationStartRequest,
  parseAutomationStoreJson,
} from '../schema';

describe('automation schema bounds', () => {
  const definition = createAutomationDefinition('auto-1', 'Valid', 1000);

  it('accepts a canonical definition and store', () => {
    expect(parseAutomationDefinition(definition)).toEqual(definition);
    expect(isAutomationDefinition(definition)).toBe(true);
    expect(parseAutomationStoreJson(JSON.stringify({ version: 1, automations: [definition] })).automations).toEqual([definition]);
  });

  it('rejects oversized raw JSON before parsing', () => {
    expect(() => parseAutomationStoreJson('x'.repeat(AUTOMATION_LIMITS.maxJsonChars + 1))).toThrow(/size limit/);
  });

  it('rejects unbounded option payloads', () => {
    const hostile = {
      ...definition,
      graph: {
        nodes: [
          {
            id: 'n1',
            kind: 'transcode',
            label: 'Transcode',
            position: { x: 0, y: 0 },
            data: { kind: 'transcode', options: JSON.parse('{"__proto__":{"polluted":true}}') as Record<string, unknown> },
          },
        ],
        edges: [],
      },
    };
    expect(() => parseAutomationDefinition(hostile)).toThrow();
  });

  it('rejects cyclic and deeply nested untrusted values', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(isBoundedAutomationJsonValue(cyclic)).toBe(false);

    let nested: unknown = 0;
    for (let index = 0; index <= AUTOMATION_LIMITS.maxJsonDepth + 1; index += 1) nested = { nested };
    expect(isBoundedAutomationJsonValue(nested)).toBe(false);
  });

  it('rejects huge positions and too many graph nodes', () => {
    const hugePosition = {
      ...definition,
      graph: {
        nodes: [{ id: 'n1', kind: 'input', label: 'Input', position: { x: 1e20, y: 0 }, data: { kind: 'input' } }],
        edges: [],
      },
    };
    expect(() => parseAutomationDefinition(hugePosition)).toThrow();

    const manyNodes = {
      ...definition,
      graph: {
        nodes: Array.from({ length: AUTOMATION_LIMITS.maxNodesPerGraph + 1 }, (_, index) => ({
          id: `n${index}`,
          kind: 'input',
          label: 'Input',
          position: { x: 0, y: 0 },
          data: { kind: 'input' },
        })),
        edges: [],
      },
    };
    expect(() => parseAutomationDefinition(manyNodes)).toThrow();
  });

  it('rejects hostile duplicate requests with extra keys', () => {
    expect(parseAutomationDuplicateRequest({ id: 'auto-1', name: 'Copy' })).toEqual({ id: 'auto-1', name: 'Copy' });
    expect(() => parseAutomationDuplicateRequest({ id: 'auto-1', name: 'Copy', admin: true })).toThrow();
  });

  it('parses start/cancel runtime requests with bounded strings and enums', () => {
    expect(
      parseAutomationStartRequest({
        definition,
        runtime: {
          inputPath: 'C:/in.mov',
          outputPath: 'C:/out.mp4',
          availableBackends: ['FFMPEG'],
          mediaKind: 'video',
          tempRoot: 'custom',
        },
      }),
    ).toMatchObject({ definition, runtime: { mediaKind: 'video', tempRoot: 'custom' } });
    expect(parseAutomationCancelRequest({ runId: 'run-1' })).toEqual({ runId: 'run-1' });

    expect(() => parseAutomationStartRequest({ definition, runtime: { tempRoot: 'C:/tmp' } })).toThrow(/temp root/);
    expect(() => parseAutomationStartRequest({ definition, runtime: { tempRoot: '../escape' } })).toThrow(/temp root/);
    expect(() => parseAutomationStartRequest({ definition, runtime: { availableBackends: ['BAD'] } })).toThrow();
    expect(() => parseAutomationStartRequest({ definition, runtime: { mediaKind: 'document' } })).toThrow();
    expect(() => parseAutomationCancelRequest({ runId: 'run-1', extra: true })).toThrow();
  });
});
