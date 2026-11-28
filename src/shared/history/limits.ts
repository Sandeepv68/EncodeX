export const HISTORY_LIMITS = {
  maxEntries: 500,
  maxIdLength: 128,
  maxPathLength: 4096,
  maxErrorLength: 4000,
  maxDetailLength: 8000,
  maxMetadataKeys: 20,
  maxMetadataValueLength: 200,
  maxPaths: 20,
  maxTimestamp: Number.MAX_SAFE_INTEGER,
  maxFileBytes: 5 * 1024 * 1024,
  maxJsonChars: 5 * 1024 * 1024,
  maxThumbnailBytes: 2 * 1024 * 1024,
  maxThumbnails: 100,
} as const;

export const HISTORY_STORE = {
  directory: 'history',
  filename: 'history.json',
  backupSuffix: '.bak',
  thumbnailsDirectory: 'thumbnails',
  migrationMarker: 'history-migrated-v1',
} as const;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function isHistoryMetadataValue(value: unknown): value is string | number | boolean {
  if (typeof value === 'boolean') return true;
  if (typeof value === 'string') return value.length <= HISTORY_LIMITS.maxMetadataValueLength;
  return typeof value === 'number' && Number.isFinite(value);
}

export function isHistoryMetadata(value: unknown): value is Record<string, string | number | boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const entries = Object.entries(value);
  if (entries.length > HISTORY_LIMITS.maxMetadataKeys) return false;
  return entries.every(
    ([key, item]) =>
      key.length > 0 && key.length <= HISTORY_LIMITS.maxMetadataValueLength && !FORBIDDEN_KEYS.has(key) && isHistoryMetadataValue(item),
  );
}
