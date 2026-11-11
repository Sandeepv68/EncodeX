/**
 * @fileoverview Unit tests for the cross-queue output claims.
 *
 * The two queues run independently, so the only thing that stops them from
 * writing the same file is this shared claim registry.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OutputClaimRegistry, batchOutputClaims, muxOutputClaims, normalizeClaimPath } from '../output-claims';

describe('OutputClaimRegistry', () => {
  let registry: OutputClaimRegistry;

  beforeEach(() => {
    registry = new OutputClaimRegistry();
  });

  it('normalizes paths for comparison', () => {
    expect(normalizeClaimPath('C:\\Out\\A.MKV')).toBe('c:/out/a.mkv');
    expect(normalizeClaimPath('c:/out/a.mkv')).toBe('c:/out/a.mkv');
  });

  it('reports a claimed path', () => {
    registry.claim('C:/out/a.mkv', 'job-1');
    expect(registry.isClaimed('c:/OUT/a.mkv')).toBe(true);
    expect(registry.isClaimed('C:/out/b.mkv')).toBe(false);
  });

  it('keeps a path claimed while another job still claims it', () => {
    registry.claim('C:/out/a.mkv', 'job-1');
    registry.claim('C:/out/a.mkv', 'job-2');
    registry.release('C:/out/a.mkv', 'job-1');
    expect(registry.isClaimed('C:/out/a.mkv')).toBe(true);
    registry.release('C:/out/a.mkv', 'job-2');
    expect(registry.isClaimed('C:/out/a.mkv')).toBe(false);
  });

  it('releases every claim a job holds', () => {
    registry.claim('C:/out/a.mkv', 'job-1');
    registry.claim('C:/out/b.mkv', 'job-1');
    registry.claim('C:/out/b.mkv', 'job-2');
    registry.releaseAll('job-1');
    expect(registry.isClaimed('C:/out/a.mkv')).toBe(false);
    expect(registry.isClaimed('C:/out/b.mkv')).toBe(true);
  });

  it('lists the conflicting paths among many', () => {
    registry.claim('C:/out/a.mkv', 'job-1');
    expect(registry.findConflicts(['C:/out/b.mkv', 'c:/OUT/A.MKV'])).toEqual(['c:/OUT/A.MKV']);
  });
});

describe('the shared registries', () => {
  it('keeps the batch and mux claims apart', () => {
    batchOutputClaims.claim('C:/out/batch.mkv', 'batch-1');
    muxOutputClaims.claim('C:/out/mux.mkv', 'mux-1');
    expect(batchOutputClaims.isClaimed('C:/out/mux.mkv')).toBe(false);
    expect(muxOutputClaims.isClaimed('C:/out/batch.mkv')).toBe(false);
    batchOutputClaims.releaseAll('batch-1');
    muxOutputClaims.releaseAll('mux-1');
  });
});
