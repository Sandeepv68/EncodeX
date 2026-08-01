export const HWACCEL_MODES = ['auto', 'encode'] as const;

export type HwAccelMode = (typeof HWACCEL_MODES)[number];

export const HWACCEL_DEFAULTS = {
  ENABLED: true,
  MODE: 'auto' as HwAccelMode,
} as const;

export const HWACCEL_STORAGE_KEY = 'encodex-hwaccel';

export const ENCODER_TYPES = ['auto', 'hardware', 'software'] as const;

export type EncoderType = (typeof ENCODER_TYPES)[number];

export const ENCODER_TYPE_DEFAULT: EncoderType = 'auto';
