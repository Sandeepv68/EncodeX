import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';
import { conversionOptionsForStep, executeAutomationStep } from '../step-executors';
import type { AutomationStep } from '../../../shared/automations/types';
import type { ConversionProgress } from '../../../shared/types';
import type { ITranscoder } from '../../transcoders/types';

function step(kind: AutomationStep['kind'], options: Record<string, unknown> = {}): AutomationStep {
  return {
    nodeId: 'n1',
    stageId: 's1',
    kind,
    backend: 'FFMPEG',
    inputRef: '{{previous.output}}',
    outputPath: '/out',
    options,
  };
}

function fakeTranscoder(emitter: EventEmitter, convertError?: unknown): ITranscoder {
  return {
    getInfo: async () => ({}) as never,
    convert: () => {
      if (convertError !== undefined) throw convertError;
      return emitter;
    },
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getType: () => 'FFMPEG',
  };
}

describe('automation step executors', () => {
  it('rejects invalid and unsupported step options', () => {
    expect(() => conversionOptionsForStep(step('transcode', null as never))).toThrow();
    expect(() => conversionOptionsForStep(step('stage', { videoCodec: 'x' }))).toThrow(
      expect.objectContaining({ detail: 'Unsupported automation step kind: stage' }),
    );
  });

  it('normalizes conversion options for each executable operation', () => {
    expect(conversionOptionsForStep(step('cut', { videoCodec: 'x' }))).toEqual({ videoCodec: 'x' });
    expect(conversionOptionsForStep(step('extractAudio', {}))).toEqual({
      audio: true,
      video: false,
      copy: false,
      audioCodec: 'mp3',
    });
    expect(conversionOptionsForStep(step('extractAudio', { audioCodec: 'aac' }))).toEqual({
      audioCodec: 'aac',
      audio: true,
      video: false,
      copy: false,
    });
    expect(conversionOptionsForStep(step('remux', {}))).toEqual({ copy: true });
    expect(conversionOptionsForStep(step('demux', {}))).toEqual({ copy: true });
    expect(conversionOptionsForStep(step('compressImage', {}))).toEqual({ video: false, audio: false });
  });

  it('converts synchronous and emitted non-Error failures into Error instances', async () => {
    expect(() => executeAutomationStep(step('transcode'), '/in', vi.fn(), () => fakeTranscoder(new EventEmitter(), 'bad'))).toThrow('bad');

    const emitter = new EventEmitter();
    const execution = executeAutomationStep(step('transcode'), '/in', vi.fn(), () => fakeTranscoder(emitter));
    const rejected = expect(execution.promise).rejects.toThrow('bad');
    emitter.emit('error', 'bad');
    await rejected;
  });

  it('ignores progress after settlement and cancels through the transcoder', async () => {
    const emitter = new EventEmitter();
    const cancel = vi.fn();
    const onProgress = vi.fn();
    const transcoder = fakeTranscoder(emitter, undefined);
    transcoder.cancel = cancel;
    const execution = executeAutomationStep(step('transcode'), '/in', onProgress, () => transcoder);

    emitter.emit('end');
    emitter.emit('progress', { percent: 50 } as ConversionProgress);
    execution.cancel();

    await execution.promise;
    expect(onProgress).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
