/**
 * @fileoverview Unit tests for the four-tier MCP safety model (roadmap §6 / R2).
 */

import { describe, it, expect } from 'vitest';
import { ErrorCode } from '../../shared/errors';
import {
  MAX_BATCH_FILES,
  SAFETY_TIERS,
  assertSafeExtraArgs,
  batchEnvelopeExceeds,
  findUnsafeExtraArgs,
  isMutating,
  tierForTool,
} from '../safety';

describe('safety tiers', () => {
  it('classifies representative tools', () => {
    expect(tierForTool('list_jobs')).toBe(SAFETY_TIERS.READ);
    expect(tierForTool('recommend_settings')).toBe(SAFETY_TIERS.PLAN);
    expect(tierForTool('convert_media')).toBe(SAFETY_TIERS.WRITE);
    expect(tierForTool('commit_operation')).toBe(SAFETY_TIERS.WRITE);
  });

  it('defaults unknown tools to READ', () => {
    expect(tierForTool('totally-unknown')).toBe(SAFETY_TIERS.READ);
  });

  it('treats the new R2 tools as read-only', () => {
    expect(isMutating('explain_error')).toBe(false);
    expect(isMutating('advise_encoding')).toBe(false);
    expect(isMutating('quality_report')).toBe(false);
  });

  it('marks write tools as mutating', () => {
    expect(isMutating('batch_convert')).toBe(true);
    expect(isMutating('cut_video')).toBe(true);
  });

  it('caps batch fan-out', () => {
    expect(MAX_BATCH_FILES).toBe(500);
  });
});

describe('findUnsafeExtraArgs', () => {
  it('allows benign FFmpeg output arguments', () => {
    expect(findUnsafeExtraArgs(['-movflags', '+faststart', '-crf:0', '23', '-pix_fmt', 'yuv420p'])).toEqual([]);
  });

  it('rejects shell metacharacters and second commands', () => {
    expect(findUnsafeExtraArgs(['-vf', 'scale=1;rm -rf /'])).toHaveLength(1);
    expect(findUnsafeExtraArgs(['$(whoami)'])).toHaveLength(1);
    expect(findUnsafeExtraArgs(['a && b'])).toHaveLength(1);
    expect(findUnsafeExtraArgs(['line\nbreak'])).toHaveLength(1);
  });

  it('treats undefined and empty input as safe', () => {
    expect(findUnsafeExtraArgs(undefined)).toEqual([]);
    expect(findUnsafeExtraArgs([])).toEqual([]);
  });
});

describe('assertSafeExtraArgs', () => {
  it('does not throw for safe arguments', () => {
    expect(() => assertSafeExtraArgs(['-movflags', '+faststart'])).not.toThrow();
  });

  it('throws UNSAFE_ARGUMENTS for a rejected entry', () => {
    try {
      assertSafeExtraArgs(['-vf', 'scale=1; rm -rf /']);
      throw new Error('expected assertSafeExtraArgs to throw');
    } catch (error) {
      expect((error as { code?: string }).code).toBe(ErrorCode.UNSAFE_ARGUMENTS);
    }
  });
});

describe('batchEnvelopeExceeds', () => {
  it('detects a batch that grew in count or bytes', () => {
    expect(batchEnvelopeExceeds({ fileCount: 3, totalBytes: 100 }, { fileCount: 4, totalBytes: 100 })).toBe(true);
    expect(batchEnvelopeExceeds({ fileCount: 3, totalBytes: 100 }, { fileCount: 3, totalBytes: 200 })).toBe(true);
  });

  it('accepts an unchanged or smaller batch', () => {
    expect(batchEnvelopeExceeds({ fileCount: 3, totalBytes: 100 }, { fileCount: 3, totalBytes: 100 })).toBe(false);
    expect(batchEnvelopeExceeds({ fileCount: 3, totalBytes: 100 }, { fileCount: 2, totalBytes: 50 })).toBe(false);
  });
});
