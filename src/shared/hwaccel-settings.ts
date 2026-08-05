/**
 * @fileoverview Hardware acceleration configuration and settings.
 * Defines hardware acceleration modes and encoder type options.
 */

/**
 * Supported hardware acceleration modes.
 * @const {readonly string[]} HWACCEL_MODES
 */
export const HWACCEL_MODES = ['auto', 'encode'] as const;

/**
 * Hardware acceleration mode type.
 * @typedef {string} HwAccelMode
 */
export type HwAccelMode = (typeof HWACCEL_MODES)[number];

/**
 * Default hardware acceleration settings.
 * @const {Object} HWACCEL_DEFAULTS
 */
export const HWACCEL_DEFAULTS = {
  ENABLED: true,
  MODE: 'auto' as HwAccelMode,
} as const;

export const HWACCEL_STORAGE_KEY = 'encodex-hwaccel';

/**
 * Supported encoder types (hardware, software, or auto-detect).
 * @const {readonly string[]} ENCODER_TYPES
 */
export const ENCODER_TYPES = ['auto', 'hardware', 'software'] as const;

/**
 * Encoder type selection.
 * @typedef {string} EncoderType
 */
export type EncoderType = (typeof ENCODER_TYPES)[number];

export const ENCODER_TYPE_DEFAULT: EncoderType = 'auto';
