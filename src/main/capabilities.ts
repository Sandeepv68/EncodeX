/**
 * @fileoverview FFmpeg and transcoder capability detection and reporting.
 * Discovers available codecs, encoders, and hardware acceleration features.
 */

import { spawnSync } from 'child_process';
import { Logger } from '../shared/logger';
import { EncoderCapabilities } from '../shared/types';
import { CAPABILITY_PROBE_TIMEOUT_MS } from '../shared/constants';
import { getFfmpegPath } from './transcoders/ffmpeg-utils';

const log = new Logger('main/capabilities');

const ENCODER_LINE = /^([VAS])\S+\s+(\S+)/;

export function parseEncoderOutput(stdout: string): Pick<EncoderCapabilities, 'videoEncoders' | 'audioEncoders'> {
  const videoEncoders: string[] = [];
  const audioEncoders: string[] = [];
  for (const rawLine of String(stdout).split(/\r?\n/)) {
    const match = rawLine.trimStart().match(ENCODER_LINE);
    if (!match) continue;
    const kind = match[1];
    const name = match[2];
    if (kind === 'V') videoEncoders.push(name);
    else if (kind === 'A') audioEncoders.push(name);
  }
  return { videoEncoders, audioEncoders };
}

export function parseHwaccelOutput(stdout: string): string[] {
  const lines = String(stdout).trim().split(/\r?\n/);
  lines.shift();
  return lines.join(' ').split(/\s+/).filter(Boolean);
}

function runFfmpeg(args: string[]): string {
  const ffmpegPath = getFfmpegPath();
  const result = spawnSync(ffmpegPath, args, {
    encoding: 'utf-8' as BufferEncoding,
    timeout: CAPABILITY_PROBE_TIMEOUT_MS,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`ffmpeg ${args.join(' ')} exited with code ${result.status}`);
  }
  return String(result.stdout ?? '');
}

let cached: EncoderCapabilities | null = null;

export function getEncoderCapabilities(force = false): EncoderCapabilities | null {
  if (cached && !force) return cached;
  try {
    const encodersOut = runFfmpeg(['-hide_banner', '-encoders']);
    const hwaccelsOut = runFfmpeg(['-hide_banner', '-hwaccels']);
    const { videoEncoders, audioEncoders } = parseEncoderOutput(encodersOut);
    const hwaccels = parseHwaccelOutput(hwaccelsOut);
    cached = { videoEncoders, audioEncoders, hwaccels };
    log.info(
      'Detected ffmpeg capabilities:',
      videoEncoders.length,
      'video encoders,',
      audioEncoders.length,
      'audio encoders,',
      hwaccels.length,
      'hwaccels',
    );
    return cached;
  } catch (err) {
    log.error('Encoder capability probe failed:', err);
    return null;
  }
}
