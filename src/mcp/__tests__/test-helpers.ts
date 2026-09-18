/**
 * @fileoverview Shared test doubles for the MCP layer tests.
 * Provides a {@link FakeTranscoder} implementing {@link ITranscoder} with
 * scriptable success/error/progress behavior, driven through the MCP job
 * manager's injectable transcoder factory.
 */

import { EventEmitter } from 'events';
import type { ITranscoder } from '../../main/transcoders/types';
import type { ConversionOptions, ConversionProgress, MediaInfo } from '../../shared/types';

/**
 * Behavior knobs for a {@link FakeTranscoder}.
 * @interface FakeTranscoderOptions
 * @property {boolean} [fail=false] - When true, the conversion emits 'error'.
 * @property {boolean} [hang=false] - When true, the conversion never emits a
 *   terminal event, keeping the job RUNNING indefinitely.
 * @property {ConversionProgress[]} [progress=[]] - Progress events emitted
 *   before completion (or failure).
 */
export interface FakeTranscoderOptions {
  fail?: boolean;
  hang?: boolean;
  progress?: ConversionProgress[];
}

/**
 * A deterministic {@link ITranscoder} for tests. `convert` emits the configured
 * progress events asynchronously, then 'end' (or 'error' when `fail`). It never
 * touches the filesystem, so jobs can run against non-existent paths.
 * @class FakeTranscoder
 */
export class FakeTranscoder implements ITranscoder {
  /** How many times convert() has been called. */
  conversions = 0;

  /**
   * Creates a fake transcoder.
   * @param {FakeTranscoderOptions} [options] - Behavior overrides.
   */
  constructor(private readonly options: FakeTranscoderOptions = {}) {}

  /**
   * Emits scripted progress/end or error on a microtask. Ignores the file paths.
   * @param {string} input - Input path (ignored).
   * @param {string} output - Output path (ignored).
   * @param {ConversionOptions} _options - Options (ignored).
   * @returns {EventEmitter} An emitter that resolves asynchronously.
   */
  convert(input: string, output: string, _options: ConversionOptions): EventEmitter {
    this.conversions += 1;
    const emitter = new EventEmitter();
    if (this.options.hang) {
      return emitter;
    }
    queueMicrotask(() => {
      for (const p of this.options.progress ?? []) {
        emitter.emit('progress', p);
      }
      if (this.options.fail) {
        emitter.emit('error', new Error('fake conversion failure'));
      } else {
        emitter.emit('end');
      }
    });
    return emitter;
  }

  /**
   * Returns a minimal MediaInfo for the given input.
   * @param {string} input - Input path.
   * @returns {Promise<MediaInfo>} Probe stub.
   */
  async getInfo(input: string): Promise<MediaInfo> {
    return { file: input, format: 'mov,mp4', size: 12345, duration: 60, bitrate: '2000k', streams: [] };
  }

  /** No-op cancellation. @returns {void} */
  cancel(): void {
    /* no-op */
  }

  /** No-op pause. @returns {void} */
  pause(): void {
    /* no-op */
  }

  /** No-op resume. @returns {void} */
  resume(): void {
    /* no-op */
  }

  /**
   * Backend identifier.
   * @returns {string} Always 'FFMPEG'.
   */
  getType(): string {
    return 'FFMPEG';
  }
}

/**
 * A progress stub with all fields populated.
 * @param {number} [percent=50] - Progress percentage.
 * @returns {ConversionProgress} A complete ConversionProgress object.
 */
export function progressStub(percent = 50): ConversionProgress {
  return { percent, time: '00:00:30', fps: 240, speed: '4.0x', eta: '00:00:10', bitrate: '1500k' };
}
