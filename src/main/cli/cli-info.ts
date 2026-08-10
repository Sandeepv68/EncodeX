/**
 * @fileoverview Implementation of the `info` and `capabilities` CLI subcommands.
 * `info` probes a media file and renders format + per-stream metadata as either
 * a human table or JSON; `capabilities` lists the detected encoders/hwaccels.
 */

import type { ITranscoder } from '../transcoders/types';
import type { MediaInfo, MediaStreamInfo, EncoderCapabilities } from '../../shared/types';
import { getEncoderCapabilities } from '../capabilities';
import { createError, ErrorCode } from '../../shared/errors';
import { spinner, printTable, data, success, error as printError } from './cli-ui';
import { formatBytes, formatDuration } from './cli-util';
import type { CliThemeId } from '../cli-logo';

/**
 * Runs the `info` subcommand: probes the input and prints format/stream
 * metadata as a human table or (with `--json`) as JSON on stdout.
 * @param {ITranscoder} transcoder - Transcoder used to probe the file.
 * @param {string} input - Input file path.
 * @param {boolean} json - When true, emit JSON on stdout instead of a table.
 * @param {CliThemeId} _themeId - Reserved for future themed output.
 * @returns {Promise<void>} Resolves once info is printed.
 */
export async function runInfo(transcoder: ITranscoder, input: string, json: boolean, _themeId: CliThemeId): Promise<void> {
  const spin = spinner('Probing media info…');
  let info: MediaInfo;
  try {
    info = await transcoder.getInfo(input);
  } catch (err) {
    spin.stop();
    printError(`Failed to read media info: ${(err as Error).message}`);
    throw createError(ErrorCode.PROBE_FAILED, `Failed to read media info: ${(err as Error).message}`);
  }
  spin.succeed('Media info');

  if (json) {
    data(JSON.stringify(info, null, 2));
    return;
  }

  printTable([
    ['File', info.file],
    ['Format', info.formatLong || info.format],
    ['Size', formatBytes(info.size)],
    ['Duration', formatDuration(info.duration)],
    ['Bitrate', info.bitrate],
  ]);
  for (const stream of info.streams) {
    printStream(stream);
  }
  success(`Probed ${info.streams.length} stream${info.streams.length === 1 ? '' : 's'}`);
}

/**
 * Prints a single media stream as an indented table section.
 * @param {MediaStreamInfo} stream - Stream metadata to render.
 * @returns {void}
 */
function printStream(stream: MediaStreamInfo): void {
  const rows: Array<[string, string]> = [
    ['Stream', `#${stream.index} (${stream.type})`],
    ['Codec', stream.codecLong || stream.codec],
  ];
  if (stream.type === 'video') {
    if (stream.width !== undefined && stream.height !== undefined) rows.push(['Resolution', `${stream.width}x${stream.height}`]);
    if (stream.frameRate) rows.push(['Frame rate', stream.frameRate]);
    if (stream.avgFrameRate) rows.push(['Avg frame rate', stream.avgFrameRate]);
    if (stream.displayAspectRatio) rows.push(['Aspect ratio', stream.displayAspectRatio]);
    if (stream.pixelFormat) rows.push(['Pixel format', stream.pixelFormat]);
    if (stream.profile) rows.push(['Profile', stream.profile]);
    if (stream.bitDepth !== undefined) rows.push(['Bit depth', String(stream.bitDepth)]);
    if (stream.bitrate) rows.push(['Bitrate', stream.bitrate]);
  } else if (stream.type === 'audio') {
    if (stream.sampleRate !== undefined) rows.push(['Sample rate', `${stream.sampleRate} Hz`]);
    if (stream.channels !== undefined) rows.push(['Channels', String(stream.channels)]);
    if (stream.channelLayout) rows.push(['Channel layout', stream.channelLayout]);
    if (stream.sampleFormat) rows.push(['Sample format', stream.sampleFormat]);
    if (stream.bitrate) rows.push(['Bitrate', stream.bitrate]);
  } else {
    if (stream.language) rows.push(['Language', stream.language]);
    if (stream.title) rows.push(['Title', stream.title]);
  }
  if (stream.duration !== undefined) rows.push(['Duration', formatDuration(stream.duration)]);
  printTable(rows);
}

/**
 * Runs the `capabilities` subcommand: probes FFmpeg encoders/hwaccels and
 * prints them as a human table or (with `--json`) JSON on stdout.
 * @param {boolean} json - When true, emit JSON on stdout instead of tables.
 * @param {CliThemeId} _themeId - Reserved for future themed output.
 * @returns {Promise<void>} Resolves once capabilities are printed.
 */
export async function runCapabilities(json: boolean, _themeId: CliThemeId): Promise<void> {
  const spin = spinner('Probing encoder capabilities…');
  const caps: EncoderCapabilities | null = getEncoderCapabilities();
  spin.succeed('Capabilities');

  if (!caps) {
    printError('Could not determine encoder capabilities (ffmpeg probe failed).');
    throw createError(ErrorCode.FFMPEG_NOT_FOUND, 'Could not determine encoder capabilities');
  }

  if (json) {
    data(JSON.stringify(caps, null, 2));
    return;
  }

  printTable([
    ['Video encoders', `${caps.videoEncoders.length}`],
    ['Audio encoders', `${caps.audioEncoders.length}`],
    ['Hardware accel', `${caps.hwaccels.length}`],
  ]);
  printTable([['Video encoders', caps.videoEncoders.join(', ') || '—']]);
  printTable([['Audio encoders', caps.audioEncoders.join(', ') || '—']]);
  printTable([['Hardware accel', caps.hwaccels.join(', ') || '—']]);
}
