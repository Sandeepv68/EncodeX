/**
 * @fileoverview Unit tests for the library-wide agent planner (F20).
 */

import { describe, it, expect } from 'vitest';
import { planAgent, type AgentRequest } from '../agent';
import { planWorkflow } from '../workflow';
import type { ConversionProfile, EncoderCapabilities } from '../../types';
import type { MediaFacts } from '../types';

const capabilities: EncoderCapabilities = { videoEncoders: ['libx264'], audioEncoders: ['aac'], hwaccels: [] };

const bitrateProfile: ConversionProfile = {
  id: 'test-720p',
  name: 'Test 720p',
  category: 'web-social',
  container: 'mp4',
  videoCodec: 'libx264',
  audioCodec: 'aac',
  videoBitrate: '1500k',
  audioBitrate: '128k',
  scale: '1280x720',
  builtin: true,
};

const crfProfile: ConversionProfile = {
  ...bitrateProfile,
  id: 'test-crf',
  name: 'Test CRF',
  videoBitrate: undefined,
  crf: 23,
};

function facts(file: string, sizeBytes = 500_000_000): MediaFacts {
  return {
    file,
    format: 'mp4',
    sizeBytes,
    durationSeconds: 600,
    hasVideo: true,
    hasAudio: true,
    subtitleCount: 0,
    video: { codec: 'h264', width: 1920, height: 1080, hdr: false, interlaced: false },
    audio: { codec: 'aac', channels: 2 },
  };
}

function request(overrides: Partial<AgentRequest> = {}): AgentRequest {
  return {
    intent: 'compress for web',
    files: [facts('C:/media/a.mp4')],
    profiles: [bitrateProfile],
    capabilities,
    ...overrides,
  };
}

describe('planAgent', () => {
  it('skips every file when no profile matches', () => {
    const plan = planAgent(request({ profiles: [] }));
    expect(plan.actions).toHaveLength(0);
    expect(plan.skips).toHaveLength(1);
    expect(plan.workflow.steps).toHaveLength(0);
  });

  it('plans one action per file and a runnable workflow', () => {
    const plan = planAgent(request({ files: [facts('C:/media/a.mp4'), facts('C:/media/b.mp4')] }));
    expect(plan.actions).toHaveLength(2);
    expect(plan.actions.map((action) => action.id)).toEqual(['convert_0', 'convert_1']);
    expect(plan.actions[0].profileId).toBe('test-720p');
    expect(plan.actions[0].estimatedSavings).toBeGreaterThan(0.5);
    const workflowPlan = planWorkflow(plan.workflow);
    expect(workflowPlan.valid).toBe(true);
    expect(plan.isEstimated).toBe(true);
  });

  it('applies the minSavings gate when the plan carries a target bitrate', () => {
    const plan = planAgent(request({ options: { minSavings: 0.9 } }));
    expect(plan.actions).toHaveLength(0);
    expect(plan.skips[0].reason).toMatch(/threshold/);
  });

  it('does not apply the minSavings gate to a CRF-only plan', () => {
    const plan = planAgent(request({ profiles: [crfProfile], options: { minSavings: 0.9 } }));
    expect(plan.actions).toHaveLength(1);
  });

  it('honours the maxFiles cap', () => {
    const plan = planAgent(
      request({ files: [facts('C:/media/a.mp4'), facts('C:/media/b.mp4'), facts('C:/media/c.mp4')], options: { maxFiles: 2 } }),
    );
    expect(plan.actions).toHaveLength(2);
    expect(plan.notes.some((note) => note.includes('maxFiles'))).toBe(true);
  });

  it('fills outputs via the resolveOutput callback', () => {
    const plan = planAgent(request({ resolveOutput: (fact, index) => `C:/out/${index}.mp4` }));
    expect(plan.actions[0].output).toBe('C:/out/0.mp4');
    expect(plan.workflow.steps[0].args?.output).toBe('C:/out/0.mp4');
  });

  it('notes an empty file list', () => {
    const plan = planAgent(request({ files: [] }));
    expect(plan.actions).toHaveLength(0);
    expect(plan.notes.some((note) => note.includes('No files'))).toBe(true);
  });
});
