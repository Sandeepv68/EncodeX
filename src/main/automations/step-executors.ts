/**
 * @fileoverview Maps automation operation nodes to safe transcoder executions.
 */

import { EventEmitter } from 'events';
import { createTranscoder } from '../transcoders/factory';
import { isConversionOptionsLike } from '../../shared/mux-queue-guards';
import { createError, ErrorCode, ERROR_MESSAGES } from '../../shared/errors';
import type { ConversionOptions, ConversionProgress } from '../../shared/types';
import type { AutomationStep } from '../../shared/automations/types';
import type { AutomationStepExecution, AutomationTranscoderFactory } from './types';

function defaultAudioCodec(options: ConversionOptions): string | undefined {
  return options.audioCodec ?? 'mp3';
}

/** Converts an automation step into safe ConversionOptions for the backend. */
export function conversionOptionsForStep(step: AutomationStep): ConversionOptions {
  if (!isConversionOptionsLike(step.options)) {
    throw createError(ErrorCode.INVALID_FORMAT, ERROR_MESSAGES.INVALID_FORMAT, `Step ${step.nodeId} has invalid options`);
  }
  const options: ConversionOptions = { ...step.options };

  switch (step.kind) {
    case 'transcode':
    case 'cut':
      return options;
    case 'extractAudio':
      return {
        ...options,
        audio: true,
        video: false,
        copy: false,
        audioCodec: defaultAudioCodec(options),
      };
    case 'remux':
    case 'demux':
      return {
        ...options,
        copy: true,
      };
    case 'compressImage':
      return {
        ...options,
        video: false,
        audio: false,
      };
    default:
      throw createError(ErrorCode.INVALID_FORMAT, ERROR_MESSAGES.INVALID_FORMAT, `Unsupported automation step kind: ${step.kind}`);
  }
}

/** Runs one automation step through the injected transcoder factory. */
export function executeAutomationStep(
  step: AutomationStep,
  inputPath: string,
  onProgress: (progress: ConversionProgress) => void,
  transcoderFactory: AutomationTranscoderFactory = createTranscoder,
): AutomationStepExecution {
  const backend = step.backend ?? 'FFMPEG';
  const transcoder = transcoderFactory(backend);
  const options = conversionOptionsForStep(step);
  let emitter: EventEmitter;

  try {
    emitter = transcoder.convert(inputPath, step.outputPath, options);
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }

  const promise = new Promise<void>((resolve, reject) => {
    let settled = false;
    emitter.on('progress', (progress: ConversionProgress) => {
      if (!settled) onProgress(progress);
    });
    emitter.on('error', (err: unknown) => {
      if (settled) return;
      settled = true;
      reject(err instanceof Error ? err : new Error(String(err)));
    });
    emitter.on('end', () => {
      if (settled) return;
      settled = true;
      resolve();
    });
  });

  return { promise, cancel: () => transcoder.cancel() };
}
