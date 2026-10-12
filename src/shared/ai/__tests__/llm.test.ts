/**
 * @fileoverview Tests for the LLM operation router (AI connector plan §3, §7).
 *
 * The router is pure: it builds a closed prompt and parses a strict-JSON reply.
 * An injected fake connector exercises the transport seam without any network.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  OPERATION_IDS,
  buildOperationPrompt,
  createLLMOperationRouter,
  isCopilotOperation,
  parseOperationPlan,
} from '../llm';
import type { OperationRoutingRequest } from '../llm';
import type { AIConnector, ConnectorRequest } from '../connector';
import type { MediaFacts } from '../types';

/** A minimal video facts object. */
function videoFacts(file: string): MediaFacts {
  return {
    file,
    format: 'mp4',
    sizeBytes: 1_000_000,
    durationSeconds: 60,
    hasVideo: true,
    hasAudio: true,
    subtitleCount: 0,
    video: { codec: 'h264', width: 1920, height: 1080, hdr: false, interlaced: false },
    audio: { codec: 'aac', channels: 2 },
  };
}

/** An operation-routing request for the fake connector. */
function request(goal: string): OperationRoutingRequest {
  return {
    goal,
    operation: null,
    files: [videoFacts('/in/one.mp4')],
    profiles: [],
    capabilities: { videoEncoders: ['libx264'], audioEncoders: ['aac'], hwaccels: [] },
  };
}

/** A connector that returns a fixed reply. */
function fakeConnector(text: string): AIConnector {
  return {
    id: 'openai',
    defaultModel: 'test-model',
    complete: vi.fn(async (_req: ConnectorRequest) => ({ text, model: 'test-model' })),
  };
}

describe('isCopilotOperation', () => {
  it('accepts known operations and rejects everything else', () => {
    for (const id of OPERATION_IDS) expect(isCopilotOperation(id)).toBe(true);
    expect(isCopilotOperation('explode')).toBe(false);
    expect(isCopilotOperation(42)).toBe(false);
    expect(isCopilotOperation(null)).toBe(false);
  });
});

describe('buildOperationPrompt', () => {
  it('lists the closed vocabulary and the goal without absolute paths', () => {
    const prompt = buildOperationPrompt(request('make it smaller'));
    expect(prompt).toContain('Goal: make it smaller');
    expect(prompt).toContain('remux');
    expect(prompt).toContain('one.mp4');
    expect(prompt).not.toContain('/in/one.mp4');
  });
});

describe('parseOperationPlan', () => {
  it('parses a valid reply into a routed operation', () => {
    const routed = parseOperationPlan('{"operation":"remux","fields":{"container":"mkv"},"rationale":["why"],"confidence":2}', 'openai');
    expect(routed).toMatchObject({ operation: 'remux', fields: { container: 'mkv' }, providerId: 'openai', confidence: 1 });
    expect(routed?.rationale).toEqual(['why']);
  });

  it('reads a JSON object out of surrounding prose', () => {
    const routed = parseOperationPlan('Sure!\n```json\n{"operation":"analyze","fields":{}}\n```', 'gemini');
    expect(routed?.operation).toBe('analyze');
  });

  it('rejects unknown operations and non-object replies', () => {
    expect(parseOperationPlan('{"operation":"explode"}', 'openai')).toBeUndefined();
    expect(parseOperationPlan('not json at all', 'openai')).toBeUndefined();
    expect(parseOperationPlan('{"operation":"cut","fields":[]}', 'openai')).toMatchObject({ operation: 'cut', fields: {} });
  });

  it('defaults rationale and confidence when omitted', () => {
    const routed = parseOperationPlan('{"operation":"cut"}', 'rules');
    expect(routed?.confidence).toBe(0.5);
    expect(routed?.rationale.length).toBeGreaterThan(0);
  });
});

describe('createLLMOperationRouter', () => {
  it('returns the parsed operation on a valid reply', async () => {
    const connector = fakeConnector('{"operation":"extract_audio","fields":{"audioCodec":"libmp3lame"}}');
    const router = createLLMOperationRouter(connector, 'openai');
    const routed = await router(request('rip the audio to mp3'));
    expect(routed).toMatchObject({ operation: 'extract_audio', providerId: 'openai' });
    expect(connector.complete).toHaveBeenCalledOnce();
  });

  it('returns undefined when the transport throws', async () => {
    const connector: AIConnector = {
      id: 'openai',
      defaultModel: 'x',
      complete: vi.fn().mockRejectedValue(new Error('network down')),
    };
    const router = createLLMOperationRouter(connector, 'openai');
    await expect(router(request('anything'))).resolves.toBeUndefined();
  });

  it('returns undefined when the reply is unusable', async () => {
    const connector = fakeConnector('no json here');
    const router = createLLMOperationRouter(connector, 'openai');
    await expect(router(request('anything'))).resolves.toBeUndefined();
  });
});
