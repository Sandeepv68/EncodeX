import { randomUUID } from 'crypto';
import { Logger } from '../../shared/logger';
import { LOG_HISTORY_RECORD_FAILED } from '../../shared/log-constants';
import { parseHistoryEntry } from '../../shared/history/schema';
import type { HistoryEntry, HistoryRecorderOptions, HistoryRecordInput, HistoryThumbnailSink } from '../../shared/history/types';

const log = new Logger('main/history/recorder');

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function hasThumbnailSink(store: HistoryRecorderOptions['store']): store is HistoryRecorderOptions['store'] & HistoryThumbnailSink {
  return typeof (store as Partial<HistoryThumbnailSink>).saveThumbnail === 'function';
}

export class HistoryRecorder {
  private readonly store: HistoryRecorderOptions['store'];
  private readonly generateThumbnail: NonNullable<HistoryRecorderOptions['generateThumbnail']>;
  private readonly onEntry: HistoryRecorderOptions['onEntry'];

  constructor(options: HistoryRecorderOptions) {
    this.store = options.store;
    this.generateThumbnail = options.generateThumbnail ?? (async () => null);
    this.onEntry = options.onEntry;
  }

  async record(input: HistoryRecordInput): Promise<HistoryEntry> {
    const finishedAt = input.finishedAt ?? Date.now();
    const startedAt = Math.min(input.startedAt, finishedAt);
    const candidate: HistoryEntry = {
      id: randomUUID(),
      family: input.family,
      source: input.source,
      status: input.status,
      startedAt,
      finishedAt,
      durationMs: finishedAt - startedAt,
      inputs: (input.inputs ?? []).filter(Boolean),
      outputs: (input.outputs ?? []).filter(Boolean),
      ...(input.transcoder ? { transcoder: input.transcoder } : {}),
      ...(input.jobId ? { jobId: input.jobId } : {}),
      ...(input.runId ? { runId: input.runId } : {}),
      ...(input.error ? { error: input.error } : {}),
      metadata: input.metadata ?? {},
      thumbnail: null,
    };
    const entry = parseHistoryEntry(candidate);
    if (!entry) throw new Error('history recorder produced an invalid entry');

    const sourcePath = input.thumbnailSource ?? entry.inputs[0] ?? entry.outputs[0];
    if (sourcePath) {
      try {
        const thumbnail = await this.generateThumbnail(sourcePath);
        if (thumbnail && hasThumbnailSink(this.store)) {
          entry.thumbnail = this.store.saveThumbnail(entry.id, thumbnail.data, thumbnail.mimeType);
        }
      } catch (err) {
        log.warn(LOG_HISTORY_RECORD_FAILED, entry.id, describeError(err));
      }
    }

    try {
      this.store.add(entry);
    } catch (err) {
      log.warn(LOG_HISTORY_RECORD_FAILED, entry.id, describeError(err));
    }
    this.onEntry?.(entry);
    return entry;
  }
}
