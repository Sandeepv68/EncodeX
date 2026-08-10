/**
 * @fileoverview Typed helpers for driving the e2e mock `electronAPI` from specs.
 *
 * Every helper evaluates against the renderer page and reaches the test-only
 * `window.electronAPI.__test` surface installed by e2e/mocks/preload.js. Payloads
 * must be JSON-serializable.
 */

import type { Page } from 'playwright';
import type {
  ConversionProgress,
  EncoderCapabilities,
  ImageExifData,
  ImageFileInfo,
  LogEntry,
  MediaInfo,
  PlayerFrame,
  QueueJob,
  ThumbnailStrip,
  WaveformData,
} from '../../src/shared/types';

export interface TestSnapshot {
  windowCalls: string[];
  loginCalls: boolean[];
  revealCalls: string[];
  queueJobs: QueueJob[];
  queueState: { paused: boolean; concurrency: number };
  closeRequestedSubscribers: number;
}

function invoke(page: Page, method: string, args: unknown[]): Promise<unknown> {
  return page.evaluate(
    ([m, a]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const control = (window as any).electronAPI.__test as Record<string, (...fnArgs: unknown[]) => unknown>;
      return control[m](...a);
    },
    [method, args] as const,
  );
}

export const mockApi = {
  setSelectFile: (page: Page, v: string | null) => invoke(page, 'setSelectFile', [v]),
  setSelectFiles: (page: Page, v: string[]) => invoke(page, 'setSelectFiles', [v]),
  setSelectOutput: (page: Page, v: string | null) => invoke(page, 'setSelectOutput', [v]),
  setSelectDirectory: (page: Page, v: string | null) => invoke(page, 'setSelectDirectory', [v]),
  setMediaInfo: (page: Page, v: MediaInfo | null) => invoke(page, 'setMediaInfo', [v]),
  setImageInfo: (page: Page, v: ImageExifData | null) => invoke(page, 'setImageInfo', [v]),
  setImagePreview: (page: Page, v: string | null) => invoke(page, 'setImagePreview', [v]),
  setImageFileInfo: (page: Page, v: ImageFileInfo | null) => invoke(page, 'setImageFileInfo', [v]),
  setVideoPreview: (page: Page, v: string | null) => invoke(page, 'setVideoPreview', [v]),
  setCapabilities: (page: Page, v: EncoderCapabilities | null) => invoke(page, 'setCapabilities', [v]),
  setCompressImageResult: (page: Page, v: { savingPath: string; originalSizeBytes: number; compressedSizeBytes: number } | null) =>
    invoke(page, 'setCompressImageResult', [v]),
  setConvertBehavior: (page: Page, v: 'resolve' | 'reject' | 'hold') => invoke(page, 'setConvertBehavior', [v]),
  resolveConvert: (page: Page) => invoke(page, 'resolveConvert', []),
  rejectConvert: (page: Page) => invoke(page, 'rejectConvert', []),
  setQueueJobs: (page: Page, v: QueueJob[]) => invoke(page, 'setQueueJobs', [v]),
  setQueueState: (page: Page, v: Partial<{ paused: boolean; concurrency: number }>) =>
    invoke(page, 'setQueueState', [v]),
  setPlayerFrame: (page: Page, v: PlayerFrame | null) => invoke(page, 'setPlayerFrame', [v]),
  setWaveform: (page: Page, v: WaveformData | null) => invoke(page, 'setWaveform', [v]),
  setThumbnails: (page: Page, v: ThumbnailStrip | null) => invoke(page, 'setThumbnails', [v]),
  emit: (page: Page, channel: string, payload: unknown) => invoke(page, 'emit', [channel, payload]),
  reset: (page: Page) => invoke(page, 'reset', []),
  get: (page: Page) => invoke(page, 'get', []) as Promise<TestSnapshot>,
};

/**
 * Emits a conversion-progress event shaped like the real `onConversionProgress`
 * subscription payload: `{ input, output, progress }`.
 */
export function emitConversionProgress(
  page: Page,
  input: string,
  output: string,
  progress: Partial<ConversionProgress>,
) {
  return mockApi.emit(page, 'conversion-progress', {
    input,
    output,
    progress: {
      percent: 0,
      time: '00:00:00',
      fps: 0,
      speed: '1.0x',
      eta: '00:00:00',
      bitrate: '0k',
      ...progress,
    },
  });
}

/** Emits a queue status-change event for a job. */
export function emitQueueStatusChange(page: Page, job: QueueJob) {
  return mockApi.emit(page, 'queue-status-change', job);
}

/** Emits a queue progress event for a job. */
export function emitQueueProgress(page: Page, job: QueueJob, progress: Partial<ConversionProgress>) {
  return mockApi.emit(page, 'queue-progress', {
    job,
    progress: {
      percent: 0,
      time: '00:00:00',
      fps: 0,
      speed: '1.0x',
      eta: '00:00:00',
      bitrate: '0k',
      ...progress,
    },
  });
}

/** Emits a log message entry to the renderer log panel. */
export function emitLogMessage(page: Page, entry: Partial<LogEntry>) {
  return mockApi.emit(page, 'log-message', {
    timestamp: new Date().toISOString(),
    level: 'INFO',
    text: 'mock log entry',
    source: 'main',
    ...entry,
  });
}
