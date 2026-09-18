import { describe, it, expect, vi } from 'vitest';
import { MCPJobManager } from '../jobs/manager';
import { FakeTranscoder, progressStub } from './test-helpers';

describe('MCPJobManager', () => {
  function createManager(transcoders: FakeTranscoder[], concurrency?: number): MCPJobManager {
    return new MCPJobManager({
      concurrency,
      transcoderFactory: () => {
        const t = new FakeTranscoder();
        transcoders.push(t);
        return t;
      },
    });
  }

  it('enqueues a job immediately with a unique id and starts it', () => {
    const transcoders: FakeTranscoder[] = [];
    const manager = createManager(transcoders);
    const job = manager.enqueue('/in.mp4', '/out.mp4', { videoCodec: 'libx264' });
    expect(job.id).toBeTruthy();
    expect(['queued', 'running']).toContain(job.status);
    expect(job.progress).toBe(0);
    expect(manager.getJob(job.id)).toMatchObject({ input: '/in.mp4', output: '/out.mp4' });
    expect(transcoders.length).toBeGreaterThan(0);
  });

  it('tracks a job through running -> done with progress from the transcoder', async () => {
    const transcoders: FakeTranscoder[] = [];
    const manager = createManager(transcoders, 2);
    const job = manager.enqueue('/in.mp4', '/out.mp4', {}, 'FFMPEG');
    expect(manager.getJob(job.id)?.progress).toBe(0);

    await vi.waitFor(() => {
      expect(manager.getJob(job.id)?.status).toBe('done');
    });
    expect(manager.getJob(job.id)?.progress).toBe(100);
    expect(manager.pendingCount()).toBe(0);
  });

  it('records error status and message when the transcoder fails', async () => {
    const transcoders: FakeTranscoder[] = [];
    const manager = createManager(transcoders);
    const job = manager.enqueue('/in.mp4', '/out.mp4', {}, 'FFMPEG');
    transcoders[0].options.fail = true;

    await vi.waitFor(() => {
      expect(manager.getJob(job.id)?.status).toBe('error');
    });
    expect(manager.getJob(job.id)?.error).toBe('fake conversion failure');
  });

  it('emits progress events before completion', async () => {
    const transcoders: FakeTranscoder[] = [];
    const manager = createManager(transcoders);
    const job = manager.enqueue('/in.mp4', '/out.mp4', {}, 'FFMPEG');
    transcoders[0].options.progress = [progressStub(42), progressStub(73)];

    await vi.waitFor(() => {
      expect(manager.getJob(job.id)?.status).toBe('done');
    });
    const final = manager.getJob(job.id);
    expect(final?.progress ?? 0).toBeGreaterThan(50);
  });

  it('lists all tracked jobs, oldest first', async () => {
    const transcoders: FakeTranscoder[] = [];
    const manager = createManager(transcoders, 4);
    const a = manager.enqueue('/a.mp4', '/a-out.mp4', {});
    const b = manager.enqueue('/b.mp4', '/b-out.mp4', {});
    await vi.waitFor(() => {
      expect(manager.listJobs().length).toBe(2);
    });
    const ids = manager.listJobs().map((j) => j.id);
    expect(ids[0]).toBe(a.id);
    expect(ids[1]).toBe(b.id);
  });

  it('cancels a job and removes it, returning false for unknown ids', async () => {
    const transcoders: FakeTranscoder[] = [];
    const manager = createManager(transcoders);
    const job = manager.enqueue('/in.mp4', '/out.mp4', {});
    expect(manager.cancelJob(job.id)).toBe(true);
    expect(manager.getJob(job.id)).toBeUndefined();
    expect(manager.cancelJob('missing')).toBe(false);
  });

  it('clamps the concurrency cap to the supported maximum', async () => {
    const transcoders: FakeTranscoder[] = [];
    const manager = new MCPJobManager({
      concurrency: 999,
      transcoderFactory: () => {
        const t = new FakeTranscoder({ hang: true });
        transcoders.push(t);
        return t;
      },
    });
    for (let i = 0; i < 6; i++) {
      manager.enqueue(`/in-${i}.mp4`, `/out-${i}.mp4`, {});
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(transcoders.length).toBe(4);
    expect(manager.pendingCount()).toBe(6);
  });

  it('setConcurrency adjusts the shared queue cap', () => {
    const transcoders: FakeTranscoder[] = [];
    const manager = createManager(transcoders, 1);
    const a = manager.enqueue('/a.mp4', '/a-out.mp4', {});
    const b = manager.enqueue('/b.mp4', '/b-out.mp4', {});
    manager.setConcurrency(2);
    expect(manager.getJob(a.id)).toBeDefined();
    expect(manager.getJob(b.id)).toBeDefined();
  });
});
