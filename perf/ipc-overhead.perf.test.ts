/**
 * @fileoverview IPC communication overhead performance tests.
 * Measures latency of EventEmitter-based IPC patterns that mirror the
 * Electron main↔renderer communication model.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { EventEmitter } from 'events';
import { writeResults, logSummary } from './test-utils';
import type { PerfResult } from './test-utils';

describe('IPC Communication Overhead', () => {
  const results: PerfResult[] = [];

  afterAll(() => {
    const filePath = writeResults('phase3-ipc', results);
    logSummary(results);
    console.log(`Results written to: ${filePath}`);
  });

  it('should measure single invoke roundtrip latency', () => {
    // Simulate ipcMain.handle / ipcRenderer.invoke pattern
    const handler = new EventEmitter();
    const registered = new Map<string, (...args: unknown[]) => unknown>();

    // Register a handler (simulates ipcMain.handle)
    registered.set('test-channel', (...args: unknown[]) => {
      return { received: true, args };
    });

    // Invoke (simulates ipcRenderer.invoke)
    const RUNS = 10_000;
    const start = performance.now();

    for (let i = 0; i < RUNS; i++) {
      const fn = registered.get('test-channel');
      if (fn) fn('arg1', 'arg2');
    }

    const totalMs = performance.now() - start;
    const avgUs = (totalMs / RUNS) * 1000;

    console.log(`  Single invoke (${RUNS} calls): avg ${avgUs.toFixed(2)}μs, total ${totalMs.toFixed(1)}ms`);

    const passed = avgUs < 10; // Less than 10μs per call
    results.push({
      test: 'IPC single invoke roundtrip',
      phase: 'phase3-ipc',
      durationMs: totalMs,
      passed,
      details: { runs: RUNS, avgMicroseconds: avgUs },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it('should measure event emission throughput', () => {
    const emitter = new EventEmitter();
    let receivedCount = 0;

    emitter.on('progress', () => { receivedCount++; });

    const RUNS = 100_000;
    const start = performance.now();

    for (let i = 0; i < RUNS; i++) {
      emitter.emit('progress', { percent: i / RUNS * 100, time: '00:00:01', fps: 30, speed: '1.0x', eta: '0', bitrate: '1000k' });
    }

    const totalMs = performance.now() - start;

    expect(receivedCount).toBe(RUNS);

    const throughput = RUNS / (totalMs / 1000);
    console.log(`  Event emission (${RUNS} events): ${totalMs.toFixed(1)}ms, ${throughput.toFixed(0)} events/sec`);

    const passed = totalMs < 5000; // Less than 5s for 100k events
    results.push({
      test: 'IPC event emission throughput',
      phase: 'phase3-ipc',
      durationMs: totalMs,
      passed,
      details: { runs: RUNS, throughputPerSec: throughput },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it('should measure event storm (1000 rapid progress events)', () => {
    const emitter = new EventEmitter();
    const received: unknown[] = [];

    emitter.on('progress', (data) => { received.push(data); });

    const start = performance.now();

    // Simulate rapid progress events from 10 concurrent conversions
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 100; j++) {
        emitter.emit('progress', {
          jobId: `job-${i}`,
          percent: j,
          time: '00:00:01',
          fps: 30,
          speed: '1.0x',
          eta: '0',
          bitrate: '1000k',
        });
      }
    }

    const totalMs = performance.now() - start;

    expect(received.length).toBe(1000);

    console.log(`  Event storm (1000 events): ${totalMs.toFixed(1)}ms`);

    const passed = totalMs < 500;
    results.push({
      test: 'IPC event storm (1000 rapid events)',
      phase: 'phase3-ipc',
      durationMs: totalMs,
      passed,
      details: { eventCount: 1000 },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it('should measure queue event fanout for 100 jobs', () => {
    const emitter = new EventEmitter();
    const events: string[] = [];

    emitter.on('added', (id: string) => events.push(`added:${id}`));
    emitter.on('statusChange', (data: string) => events.push(`status:${data}`));
    emitter.on('progress', (data: string) => events.push(`progress:${data}`));

    const start = performance.now();

    // Simulate adding 100 jobs
    for (let i = 0; i < 100; i++) {
      emitter.emit('added', `job-${i}`);
      emitter.emit('statusChange', `job-${i}:RUNNING`);
      emitter.emit('progress', `job-${i}:50%`);
      emitter.emit('statusChange', `job-${i}:DONE`);
    }

    const totalMs = performance.now() - start;

    // 4 events per job * 100 jobs = 400 events
    expect(events.length).toBe(400);

    console.log(`  Queue fanout (100 jobs, 400 events): ${totalMs.toFixed(1)}ms`);

    const passed = totalMs < 1000;
    results.push({
      test: 'IPC queue event fanout (100 jobs)',
      phase: 'phase3-ipc',
      durationMs: totalMs,
      passed,
      details: { jobCount: 100, eventCount: events.length },
      timestamp: new Date().toISOString(),
    });

    expect(passed).toBe(true);
  });

  it('should measure typed channel string comparison overhead', () => {
    // Simulates the overhead of channel name matching
    const channels = [
      'select-file', 'select-files', 'select-output', 'select-directory',
      'get-media-info', 'get-image-info', 'get-image-preview',
      'convert-file', 'cancel-conversion', 'pause-conversion', 'resume-conversion',
      'queue-add', 'queue-remove', 'queue-list', 'queue-cancel-all',
      'player-open', 'player-seek', 'player-close', 'player-get-frame',
      'extract-waveform', 'extract-thumbnails',
      'window-minimize', 'window-maximize-toggle', 'window-close',
    ];

    const RUNS = 100_000;
    const start = performance.now();

    for (let i = 0; i < RUNS; i++) {
      const channel = channels[i % channels.length];
      // Simulate the Map.get lookup that happens in IPC routing
      const _found = channels.indexOf(channel);
      void _found;
    }

    const totalMs = performance.now() - start;

    console.log(`  Channel lookup (${RUNS} calls): ${totalMs.toFixed(1)}ms`);

    results.push({
      test: 'IPC channel name lookup overhead',
      phase: 'phase3-ipc',
      durationMs: totalMs,
      passed: totalMs < 2000,
      details: { runs: RUNS, channelCount: channels.length },
      timestamp: new Date().toISOString(),
    });

    expect(totalMs).toBeLessThan(2000);
  });
});
