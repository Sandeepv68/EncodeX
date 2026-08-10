/**
 * @fileoverview Implementation of the `compress` and `extract-audio` CLI
 * subcommands. Both are thin wrappers over {@link runConvert} that pre-fill
 * the conversion options (image codec/qscale for compression; audio codec and
 * `-vn` for extraction) and derive the output extension.
 */

import type { ITranscoder } from '../transcoders/types';
import { IMAGE_CODEC_MAP } from '../../shared/media-options';
import { suggestedExtensionForAudioCodec } from '../../shared/codec-containers';
import { AUDIO_EXTRACT_DEFAULT_CODEC } from '../../shared/constants';
import { deriveOutputPath, getInputExtension } from './cli-util';
import { runConvert } from './cli-convert';
import type { ConvertCliFlags } from './cli-convert';
import type { CliThemeId } from '../cli-logo';

/**
 * Flags accepted by the `compress` subcommand.
 * @interface CompressCliFlags
 * @property {string} [output] - Explicit output file (`-o, --output`).
 * @property {string} [format] - Output image format (`-f, --format`).
 * @property {string} [quality] - Quality scale (`-q, --quality`, 1-31).
 * @property {string} [scale] - Output resolution (`-s, --scale`).
 */
export interface CompressCliFlags {
  output?: string;
  format?: string;
  quality?: string;
  scale?: string;
}

/**
 * Runs the `compress` subcommand: lossily compresses an image.
 *
 * The output format defaults to the source format when not given. The image
 * encoder is looked up from {@link IMAGE_CODEC_MAP} and the quality maps to the
 * FFmpeg qscale.
 *
 * @param {string} input - Input image path.
 * @param {CompressCliFlags} flags - Parsed compress flags.
 * @param {ITranscoder} transcoder - Transcoder backend to run the job.
 * @param {number} timeoutSeconds - Hard conversion timeout in seconds.
 * @param {CliThemeId} themeId - Theme used to color the progress bar.
 * @returns {Promise<void>} Resolves when compression completes or rejects on
 *   failure/timeout.
 */
export async function runCompress(
  input: string,
  flags: CompressCliFlags,
  transcoder: ITranscoder,
  timeoutSeconds: number,
  themeId: CliThemeId,
): Promise<void> {
  const format = (flags.format ?? getInputExtension(input)).toLowerCase();
  const convertFlags = buildCompressFlags(input, flags);
  const output = flags.output ?? deriveOutputPath(input, { suffix: '_compressed', outputExt: format });
  await runConvert({ input, output, flags: convertFlags, transcoder, timeoutSeconds, themeId });
}

/**
 * Flags accepted by the `extract-audio` subcommand.
 * @interface ExtractAudioCliFlags
 * @property {string} [output] - Explicit output file (`-o, --output`).
 * @property {string} [audioCodec] - Audio encoder (`-a, --audio-codec`).
 * @property {string} [bitrateAudio] - Audio bitrate (`--bitrate-audio`).
 */
export interface ExtractAudioCliFlags {
  output?: string;
  audioCodec?: string;
  bitrateAudio?: string;
}

/**
 * Runs the `extract-audio` subcommand: extracts the audio track from a media
 * file, dropping the video stream (`-vn`).
 *
 * The output extension follows the chosen audio codec (defaulting to mp3) when
 * no explicit output is given.
 *
 * @param {string} input - Input media path.
 * @param {ExtractAudioCliFlags} flags - Parsed extract-audio flags.
 * @param {ITranscoder} transcoder - Transcoder backend to run the job.
 * @param {number} timeoutSeconds - Hard conversion timeout in seconds.
 * @param {CliThemeId} themeId - Theme used to color the progress bar.
 * @returns {Promise<void>} Resolves when extraction completes or rejects on
 *   failure/timeout.
 */
export async function runExtractAudio(
  input: string,
  flags: ExtractAudioCliFlags,
  transcoder: ITranscoder,
  timeoutSeconds: number,
  themeId: CliThemeId,
): Promise<void> {
  const audioCodec = flags.audioCodec ?? AUDIO_EXTRACT_DEFAULT_CODEC;
  const ext = suggestedExtensionForAudioCodec(audioCodec) || 'mp3';

  const convertFlags: ConvertCliFlags = {
    audioCodec,
    bitrateAudio: flags.bitrateAudio ?? '192k',
    video: false,
  };

  const output = flags.output ?? deriveOutputPath(input, { suffix: '', outputExt: ext, keepExt: false });
  await runConvert({ input, output, flags: convertFlags, transcoder, timeoutSeconds, themeId });
}

/**
 * Builds the effective conversion flags for a compress run: the image encoder
 * for the requested (or source) format, optional scale, and the quality as
 * qscale.
 * @param {string} input - Input image path.
 * @param {CompressCliFlags} flags - Parsed compress flags.
 * @returns {ConvertCliFlags} Effective convert flags.
 */
export function buildCompressFlags(input: string, flags: CompressCliFlags): ConvertCliFlags {
  const sourceExt = getInputExtension(input);
  const format = (flags.format ?? sourceExt).toLowerCase();
  const codec = IMAGE_CODEC_MAP[format] || IMAGE_CODEC_MAP.jpg;
  return { videoCodec: codec, scale: flags.scale, qscale: flags.quality ?? '23' };
}
