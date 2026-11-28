import * as z from 'zod';
import { HISTORY_LIMITS, isHistoryMetadata } from './limits';
import { HISTORY_CONVERSION_FAMILIES, HISTORY_FAMILIES, HISTORY_MIME_TYPES, HISTORY_SOURCES, HISTORY_STATUSES } from './types';
import type { HistoryContext, HistoryEntry, HistoryError, HistoryStoreData, HistoryThumbnail } from './types';

const text = (max: number, min = 0): z.ZodString => z.string().min(min).max(max);
const timestamp = z.number().int().finite().min(0).max(HISTORY_LIMITS.maxTimestamp);
const path = text(HISTORY_LIMITS.maxPathLength);
const metadata = z
  .record(text(HISTORY_LIMITS.maxMetadataValueLength), z.union([z.string(), z.number().finite(), z.boolean()]))
  .refine(isHistoryMetadata, { message: 'History metadata exceeds bounded primitive values' });

const errorSchema = z.object({
  code: text(HISTORY_LIMITS.maxIdLength).optional(),
  message: text(HISTORY_LIMITS.maxErrorLength, 1),
  detail: text(HISTORY_LIMITS.maxDetailLength).optional(),
});

const thumbnailSchema = z.object({
  path,
  mimeType: z.enum(HISTORY_MIME_TYPES),
});

export const historyEntrySchema = z
  .object({
    id: text(HISTORY_LIMITS.maxIdLength, 1),
    family: z.enum(HISTORY_FAMILIES),
    source: z.enum(HISTORY_SOURCES),
    status: z.enum(HISTORY_STATUSES),
    startedAt: timestamp,
    finishedAt: timestamp,
    durationMs: timestamp,
    inputs: z.array(path).max(HISTORY_LIMITS.maxPaths),
    outputs: z.array(path).max(HISTORY_LIMITS.maxPaths),
    transcoder: text(HISTORY_LIMITS.maxIdLength).optional(),
    jobId: text(HISTORY_LIMITS.maxIdLength).optional(),
    runId: text(HISTORY_LIMITS.maxIdLength).optional(),
    error: errorSchema.optional(),
    metadata,
    thumbnail: thumbnailSchema.nullable().optional(),
  })
  .refine((entry) => entry.finishedAt >= entry.startedAt, { message: 'finishedAt must not precede startedAt' })
  .refine((entry) => entry.durationMs === entry.finishedAt - entry.startedAt, { message: 'durationMs must match timestamps' });

export const historyStoreSchema = z.object({
  version: z.literal(1),
  entries: z.array(historyEntrySchema).max(HISTORY_LIMITS.maxEntries),
});

export const historyContextSchema = z.object({
  family: z.enum(HISTORY_CONVERSION_FAMILIES),
  source: z.enum(['gui', 'mcp']),
  metadata: metadata.optional(),
});

function emptyStore(): HistoryStoreData {
  return { version: 1, entries: [] };
}

export function parseHistoryEntry(value: unknown): HistoryEntry | null {
  const result = historyEntrySchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseHistoryError(value: unknown): HistoryError | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const result = errorSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export function parseHistoryThumbnail(value: unknown): HistoryThumbnail | null {
  if (!value || typeof value !== 'object') return null;
  const result = thumbnailSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseHistoryContext(value: unknown): HistoryContext | null {
  const result = historyContextSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseHistoryStoreJson(raw: string): HistoryStoreData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyStore();
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyStore();
  const candidate = parsed as Record<string, unknown>;
  if (candidate.version !== 1 || !Array.isArray(candidate.entries)) return emptyStore();
  const entries: HistoryEntry[] = [];
  for (const item of candidate.entries.slice(0, HISTORY_LIMITS.maxEntries)) {
    const entry = parseHistoryEntry(item);
    if (entry) entries.push(entry);
  }
  return { version: 1, entries };
}
