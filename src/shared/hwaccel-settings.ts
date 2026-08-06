/**
 * @fileoverview Hardware acceleration configuration and settings.
 * Defines hardware acceleration modes and encoder type options.
 */

import type { HwAccelMode, EncoderType } from './types';

/**
 * Supported hardware acceleration modes.
 * @const {readonly string[]} HWACCEL_MODES
 */
export const HWACCEL_MODES = ['auto', 'encode'] as const;

/**
 * Default hardware acceleration settings.
 * @const {Object} HWACCEL_DEFAULTS
 * @property {boolean} ENABLED - Whether hardware acceleration is enabled by default.
 * @property {HwAccelMode} MODE - Default hardware acceleration mode ('auto').
 */
export const HWACCEL_DEFAULTS = {
  ENABLED: true,
  MODE: 'auto' as HwAccelMode,
} as const;

/**
 * localStorage key used to persist the user's hardware acceleration settings.
 * @const {string} HWACCEL_STORAGE_KEY
 */
export const HWACCEL_STORAGE_KEY = 'encodex-hwaccel';

/**
 * Supported encoder types (hardware, software, or auto-detect).
 * @const {readonly string[]} ENCODER_TYPES
 */
export const ENCODER_TYPES = ['auto', 'hardware', 'software'] as const;

/**
 * Default encoder type selection: auto-detect between hardware and software.
 * @const {EncoderType} ENCODER_TYPE_DEFAULT
 */
export const ENCODER_TYPE_DEFAULT: EncoderType = 'auto';
