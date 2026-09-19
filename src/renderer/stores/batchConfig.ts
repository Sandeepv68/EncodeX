/**
 * @fileoverview Batch encoding configuration persistence helpers.
 * Reads and writes the last-used batch queue encoding configuration to
 * localStorage under 'encodex-batch-config' (BATCH_CONFIG_STORAGE_KEY) so
 * re-entering the Batch Queue page restores the previous session's operation,
 * codecs, container, bitrates, quality, scale and pixel format. Follows the
 * settingsStore read/persist pattern: reads validate against known option
 * lists and fall back to defaults; writes are best-effort and logged on
 * failure so a full storage quota never breaks the UI.
 */

import { Logger } from '../../shared/logger';
import { loadJson, saveJson } from '../utils/storage';
import { BATCH_CONFIG_STORAGE_KEY } from '../../shared/constants';
import { LOG_FAILED_TO_PERSIST_BATCH_CONFIG, LOG_FAILED_TO_READ_STORED_BATCH_CONFIG } from '../../shared/log-constants';
import { AUDIO_CODECS, BATCH_OPERATIONS, VIDEO_CODECS } from '../../shared/media-options';
import { ROTATION_VALUES } from '../../shared/transcoder-constants';

/**
 * The persisted batch encoding configuration snapshot.
 * @typedef {Object} BatchConfig
 * @property {string} operation - Batch operation value (one of BATCH_OPERATIONS).
 * @property {string} videoCodec - Selected video encoder name.
 * @property {string} audioCodec - Selected audio encoder name.
 * @property {string} container - Output container/format extension ('' = keep source).
 * @property {string} videoBitrate - Target video bitrate ('' = auto).
 * @property {string} audioBitrate - Target audio bitrate ('' = auto).
 * @property {string} quality - Image compression quality 1-31 ('' = auto).
 * @property {string} scale - Output resolution ('' = original).
 * @property {string} rotate - Output rotation angle ('' | '90' | '180' | '270').
 * @property {boolean} flipH - Whether to mirror the output horizontally.
 * @property {boolean} flipV - Whether to mirror the output vertically.
 * @property {string} pixelFormat - Output pixel format.
 * @property {string} outputDir - Optional output folder for new jobs; '' means
 *   outputs are written next to their source files.
 * @property {boolean} overwrite - Whether new jobs may replace existing output
 *   files.
 */
export interface BatchConfig {
  operation: string;
  videoCodec: string;
  audioCodec: string;
  container: string;
  videoBitrate: string;
  audioBitrate: string;
  quality: string;
  scale: string;
  rotate: string;
  flipH: boolean;
  flipV: boolean;
  pixelFormat: string;
  outputDir: string;
  overwrite: boolean;
}

/**
 * Fallback values used when the persisted config is missing or invalid.
 * Mirrors the BatchQueue page defaults.
 * @const {BatchConfig} DEFAULT_BATCH_CONFIG
 */
export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  operation: BATCH_OPERATIONS[0].value,
  videoCodec: VIDEO_CODECS[0].value,
  audioCodec: AUDIO_CODECS[0].value,
  container: '',
  videoBitrate: '',
  audioBitrate: '',
  quality: '',
  scale: '',
  rotate: '',
  flipH: false,
  flipV: false,
  pixelFormat: 'yuv420p',
  outputDir: '',
  overwrite: false,
};

/**
 * Per-module logger for the batch config persistence helpers.
 * @const {Logger} log
 */
const log = new Logger('renderer/stores/batchConfig');

/**
 * Reads and validates the persisted batch encoding configuration from
 * localStorage ('encodex-batch-config'). Each field is validated against the
 * known option lists (or falls back to a string check for free-form values);
 * invalid or missing values fall back to DEFAULT_BATCH_CONFIG entries. On
 * storage/parse failure the defaults are returned.
 * @returns {BatchConfig} The validated configuration snapshot.
 */
export function readStoredBatchConfig(): BatchConfig {
  const isOperation = (value: unknown): value is string => typeof value === 'string' && BATCH_OPERATIONS.some((o) => o.value === value);
  const isCodec = (value: unknown, list: readonly { value: string }[]): value is string =>
    typeof value === 'string' && list.some((entry) => entry.value === value);
  const isString = (value: unknown): value is string => typeof value === 'string';
  const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
  const parsed = loadJson<Partial<BatchConfig>>(BATCH_CONFIG_STORAGE_KEY, {}, (err) =>
    log.warn(LOG_FAILED_TO_READ_STORED_BATCH_CONFIG, err),
  );
  return {
    operation: isOperation(parsed.operation) ? parsed.operation : DEFAULT_BATCH_CONFIG.operation,
    videoCodec: isCodec(parsed.videoCodec, VIDEO_CODECS) ? parsed.videoCodec : DEFAULT_BATCH_CONFIG.videoCodec,
    audioCodec: isCodec(parsed.audioCodec, AUDIO_CODECS) ? parsed.audioCodec : DEFAULT_BATCH_CONFIG.audioCodec,
    container: isString(parsed.container) ? parsed.container : DEFAULT_BATCH_CONFIG.container,
    videoBitrate: isString(parsed.videoBitrate) ? parsed.videoBitrate : DEFAULT_BATCH_CONFIG.videoBitrate,
    audioBitrate: isString(parsed.audioBitrate) ? parsed.audioBitrate : DEFAULT_BATCH_CONFIG.audioBitrate,
    quality: isString(parsed.quality) ? parsed.quality : DEFAULT_BATCH_CONFIG.quality,
    scale: isString(parsed.scale) ? parsed.scale : DEFAULT_BATCH_CONFIG.scale,
    rotate:
      isString(parsed.rotate) && (ROTATION_VALUES as readonly string[]).includes(parsed.rotate)
        ? parsed.rotate
        : DEFAULT_BATCH_CONFIG.rotate,
    flipH: isBoolean(parsed.flipH) ? parsed.flipH : DEFAULT_BATCH_CONFIG.flipH,
    flipV: isBoolean(parsed.flipV) ? parsed.flipV : DEFAULT_BATCH_CONFIG.flipV,
    pixelFormat: isString(parsed.pixelFormat) ? parsed.pixelFormat : DEFAULT_BATCH_CONFIG.pixelFormat,
    outputDir: isString(parsed.outputDir) ? parsed.outputDir : DEFAULT_BATCH_CONFIG.outputDir,
    overwrite: isBoolean(parsed.overwrite) ? parsed.overwrite : DEFAULT_BATCH_CONFIG.overwrite,
  };
}

/**
 * Serializes the batch encoding configuration to localStorage
 * ('encodex-batch-config'). Failures are logged and swallowed so a full
 * storage quota never breaks the batch queue UI.
 * @param {BatchConfig} config - The configuration snapshot to persist.
 * @returns {void}
 */
export function persistBatchConfig(config: BatchConfig): void {
  saveJson(BATCH_CONFIG_STORAGE_KEY, config, (err) => log.warn(LOG_FAILED_TO_PERSIST_BATCH_CONFIG, err));
}
