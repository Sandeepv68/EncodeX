export const HISTORY_FAMILIES = [
  'convert',
  'audio-extract',
  'image-compress',
  'video-cut',
  'remux',
  'demux',
  'batch',
  'automation',
  'mcp',
] as const;

export const HISTORY_CONVERSION_FAMILIES = ['convert', 'audio-extract', 'image-compress', 'video-cut', 'remux', 'demux', 'mcp'] as const;

export const HISTORY_SOURCES = ['gui', 'mcp', 'automation'] as const;

export const HISTORY_STATUSES = ['succeeded', 'failed', 'cancelled'] as const;

export const HISTORY_MIME_TYPES = ['image/png', 'image/jpeg'] as const;

export type HistoryFamily = (typeof HISTORY_FAMILIES)[number];

export type HistoryConversionFamily = (typeof HISTORY_CONVERSION_FAMILIES)[number];

export type HistorySource = (typeof HISTORY_SOURCES)[number];

export type HistoryStatus = (typeof HISTORY_STATUSES)[number];

export type HistoryMimeType = (typeof HISTORY_MIME_TYPES)[number];

export interface HistoryError {
  code?: string;
  message: string;
  detail?: string;
}

export interface HistoryThumbnail {
  path: string;
  mimeType: HistoryMimeType;
}

export interface HistoryEntry {
  id: string;
  family: HistoryFamily;
  source: HistorySource;
  status: HistoryStatus;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  inputs: string[];
  outputs: string[];
  transcoder?: string;
  jobId?: string;
  runId?: string;
  error?: HistoryError;
  metadata: Record<string, string | number | boolean>;
  thumbnail?: HistoryThumbnail | null;
}

export interface HistoryStoreData {
  version: 1;
  entries: HistoryEntry[];
}

export interface HistoryContext {
  family: HistoryConversionFamily;
  source: 'gui' | 'mcp';
  metadata?: Record<string, string | number | boolean>;
}

export interface HistoryRecordInput {
  family: HistoryFamily;
  source: HistorySource;
  status: HistoryStatus;
  startedAt: number;
  finishedAt?: number;
  inputs?: string[];
  outputs?: string[];
  transcoder?: string;
  jobId?: string;
  runId?: string;
  error?: HistoryError;
  metadata?: Record<string, string | number | boolean>;
  thumbnailSource?: string;
}

export interface HistoryThumbnailData {
  data: Uint8Array;
  mimeType: HistoryMimeType;
}

export interface HistoryEntrySink {
  add(entry: HistoryEntry): HistoryEntry;
}

export interface HistoryThumbnailSink {
  saveThumbnail(id: string, data: Uint8Array, mimeType: HistoryMimeType): HistoryThumbnail;
}

export interface HistoryRecorderLike {
  record(input: HistoryRecordInput): Promise<HistoryEntry>;
}

export interface HistoryRecorderOptions {
  store: HistoryEntrySink & Partial<HistoryThumbnailSink>;
  generateThumbnail?: (sourcePath: string) => Promise<HistoryThumbnailData | null>;
  onEntry?: (entry: HistoryEntry) => void;
}
