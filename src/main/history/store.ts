import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../shared/logger';
import { LOG_HISTORY_STORE_CORRUPT, LOG_HISTORY_STORE_RECOVERED } from '../../shared/log-constants';
import { HISTORY_LIMITS, HISTORY_STORE } from '../../shared/history/limits';
import { parseHistoryStoreJson } from '../../shared/history/schema';
import type { HistoryEntry, HistoryMimeType, HistoryStoreData, HistoryThumbnail } from '../../shared/history/types';

const log = new Logger('main/history/store');

let tempSequence = 0;

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function emptyStore(): HistoryStoreData {
  return { version: 1, entries: [] };
}

export class HistoryStore {
  private readonly directory: string;
  private readonly filePath: string;
  private readonly backupPath: string;
  private readonly thumbnailsDirectory: string;

  constructor(userDataDir: string) {
    this.directory = path.join(userDataDir, HISTORY_STORE.directory);
    this.filePath = path.join(this.directory, HISTORY_STORE.filename);
    this.backupPath = `${this.filePath}${HISTORY_STORE.backupSuffix}`;
    this.thumbnailsDirectory = path.join(this.directory, HISTORY_STORE.thumbnailsDirectory);
  }

  list(): HistoryEntry[] {
    return this.load().entries;
  }

  add(entry: HistoryEntry): HistoryEntry {
    const store = this.load();
    const next = [entry, ...store.entries.filter((item) => item.id !== entry.id)];
    this.writeStore({ version: 1, entries: next });
    return entry;
  }

  remove(id: string): boolean {
    const store = this.load();
    const removed = store.entries.filter((entry) => entry.id === id);
    if (removed.length === 0) return false;
    this.cleanupThumbnails(removed);
    this.writeStore({ version: 1, entries: store.entries.filter((entry) => entry.id !== id) });
    return true;
  }

  clear(): void {
    this.cleanupThumbnails(this.load().entries);
    this.writeStore(emptyStore());
    try {
      fs.rmSync(this.backupPath, { force: true });
    } catch (err) {
      log.warn(LOG_HISTORY_STORE_CORRUPT, this.backupPath, describeError(err));
    }
  }

  saveThumbnail(id: string, data: Uint8Array, mimeType: HistoryMimeType): HistoryThumbnail {
    if (data.byteLength === 0 || data.byteLength > HISTORY_LIMITS.maxThumbnailBytes) {
      throw new Error('history thumbnail exceeds the bounded size');
    }
    fs.mkdirSync(this.thumbnailsDirectory, { recursive: true });
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, HISTORY_LIMITS.maxIdLength) || 'entry';
    const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
    let fileName = `${safeId}.${extension}`;
    let counter = 1;
    while (fs.existsSync(this.resolveThumbnail(fileName) ?? '')) {
      fileName = `${safeId}-${counter}.${extension}`;
      counter += 1;
    }
    const resolved = this.resolveThumbnail(fileName);
    if (!resolved) throw new Error('invalid history thumbnail path');
    fs.writeFileSync(resolved, data, { flag: 'wx', mode: 0o600 });
    return { path: fileName, mimeType };
  }

  getThumbnail(id: string): string | null {
    const entry = this.list().find((item) => item.id === id);
    if (!entry?.thumbnail) return null;
    const resolved = this.resolveThumbnail(entry.thumbnail.path);
    if (!resolved) return null;
    try {
      const fd = fs.openSync(resolved, 'r');
      try {
        const stat = fs.fstatSync(fd);
        if (!stat.isFile() || stat.size > HISTORY_LIMITS.maxThumbnailBytes) return null;
        const buffer = Buffer.alloc(stat.size);
        let offset = 0;
        while (offset < buffer.length) {
          const read = fs.readSync(fd, buffer, offset, buffer.length - offset, offset);
          if (read === 0) break;
          offset += read;
        }
        return `data:${entry.thumbnail.mimeType};base64,${buffer.subarray(0, offset).toString('base64')}`;
      } finally {
        fs.closeSync(fd);
      }
    } catch (err) {
      if (!(err instanceof Error && 'code' in err && (err.code === 'ENOENT' || err.code === 'ENOTDIR'))) {
        log.warn(LOG_HISTORY_STORE_CORRUPT, resolved, describeError(err));
      }
      return null;
    }
  }

  private load(): HistoryStoreData {
    const primary = this.readCandidate(this.filePath);
    if (primary) return primary;
    const backup = this.readCandidate(this.backupPath);
    if (!backup) return emptyStore();
    try {
      this.writeAtomic(this.filePath, JSON.stringify(backup, null, 2), false);
      log.info(LOG_HISTORY_STORE_RECOVERED);
    } catch (err) {
      log.warn(LOG_HISTORY_STORE_CORRUPT, this.filePath, describeError(err));
    }
    return backup;
  }

  private readCandidate(filePath: string): HistoryStoreData | null {
    try {
      const fd = fs.openSync(filePath, 'r');
      try {
        const stat = fs.fstatSync(fd);
        if (!stat.isFile() || stat.size > HISTORY_LIMITS.maxFileBytes) {
          throw new Error('operation history file is not a bounded regular file');
        }
        const buffer = Buffer.alloc(stat.size);
        let offset = 0;
        while (offset < buffer.length) {
          const read = fs.readSync(fd, buffer, offset, buffer.length - offset, offset);
          if (read === 0) break;
          offset += read;
        }
        const raw = buffer.subarray(0, offset).toString('utf8');
        JSON.parse(raw);
        return parseHistoryStoreJson(raw);
      } finally {
        fs.closeSync(fd);
      }
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return null;
      log.warn(LOG_HISTORY_STORE_CORRUPT, filePath, describeError(err));
      return null;
    }
  }

  private writeStore(store: HistoryStoreData): void {
    let entries = store.entries.slice(0, HISTORY_LIMITS.maxEntries);
    let raw = JSON.stringify({ version: 1, entries }, null, 2);
    while (raw.length > HISTORY_LIMITS.maxJsonChars && entries.length > 0) {
      const removed = entries.slice(Math.floor(entries.length / 2));
      this.cleanupThumbnails(removed);
      entries = entries.slice(0, Math.floor(entries.length / 2));
      raw = JSON.stringify({ version: 1, entries }, null, 2);
    }
    this.writeAtomic(this.filePath, raw, true);
  }

  private writeAtomic(filePath: string, raw: string, backupExisting: boolean): void {
    fs.mkdirSync(this.directory, { recursive: true });
    tempSequence += 1;
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.${tempSequence}.tmp`;
    try {
      fs.writeFileSync(tempPath, raw, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      if (backupExisting && fs.existsSync(filePath)) {
        fs.rmSync(this.backupPath, { force: true });
        fs.renameSync(filePath, this.backupPath);
      }
      fs.renameSync(tempPath, filePath);
    } finally {
      fs.rmSync(tempPath, { force: true });
    }
  }

  private cleanupThumbnails(entries: HistoryEntry[]): void {
    for (const entry of entries) {
      if (!entry.thumbnail) continue;
      const resolved = this.resolveThumbnail(entry.thumbnail.path);
      if (!resolved) continue;
      try {
        fs.rmSync(resolved, { force: true });
      } catch (err) {
        log.warn(LOG_HISTORY_STORE_CORRUPT, resolved, describeError(err));
      }
    }
  }

  private resolveThumbnail(fileName: string): string | null {
    const root = path.resolve(this.thumbnailsDirectory);
    const resolved = path.resolve(root, fileName);
    if (resolved === root || !resolved.startsWith(`${root}${path.sep}`)) return null;
    return resolved;
  }
}
