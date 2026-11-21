/**
 * @fileoverview Durable, bounded JSON persistence for automation definitions.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../shared/logger';
import { createError, ErrorCode, ERROR_MESSAGES } from '../../shared/errors';
import { LOG_AUTOMATION_STORE_CORRUPT, LOG_AUTOMATION_STORE_RECOVERED } from '../../shared/log-constants';
import { newAutomationId } from '../../shared/automations/defaults';
import { AUTOMATION_LIMITS, AUTOMATION_STORE as STORE_PATHS } from '../../shared/automations/limits';
import { parseAutomationDefinition, parseAutomationStoreJson } from '../../shared/automations/schema';
import type {
  AutomationDefinition,
  AutomationDuplicateRequest,
  AutomationExport,
  AutomationStore as AutomationStoreData,
} from '../../shared/automations/types';

const log = new Logger('main/automations/store');

let tempSequence = 0;

function emptyStore(): AutomationStoreData {
  return { version: 1, automations: [] };
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Builds the portable export envelope for a persisted definition. */
export function buildAutomationExport(definition: AutomationDefinition, exportedAt: number = Date.now()): AutomationExport {
  return { format: 'automation', version: 1, exportedAt, automation: definition };
}

/**
 * Reads and writes `userData/automations/definitions.json` atomically.
 * A valid `.bak` file is used when the primary file is missing or corrupt.
 */
export class AutomationStore {
  private readonly directory: string;
  private readonly filePath: string;
  private readonly backupPath: string;

  constructor(userDataDir: string) {
    this.directory = path.join(userDataDir, STORE_PATHS.directory);
    this.filePath = path.join(this.directory, STORE_PATHS.filename);
    this.backupPath = `${this.filePath}${STORE_PATHS.backupSuffix}`;
  }

  /** Returns every persisted definition, or an empty list when none can be read. */
  list(): AutomationDefinition[] {
    return this.load().automations;
  }

  /** Returns the definition with the given id, or null when absent. */
  get(id: string): AutomationDefinition | null {
    return this.load().automations.find((definition) => definition.id === id) ?? null;
  }

  /** Validates and persists a definition, replacing any entry with the same id. */
  save(definition: AutomationDefinition): AutomationDefinition {
    const parsed = parseAutomationDefinition(definition);
    const store = this.load();
    const index = store.automations.findIndex((entry) => entry.id === parsed.id);
    if (index === -1) store.automations.push(parsed);
    else store.automations[index] = parsed;
    this.writeStore(store);
    return parsed;
  }

  /** Removes the given id and reports whether a definition was deleted. */
  delete(id: string): boolean {
    const store = this.load();
    const next = store.automations.filter((definition) => definition.id !== id);
    if (next.length === store.automations.length) return false;
    this.writeStore({ version: 1, automations: next });
    return true;
  }

  /** Creates a fresh copy of a definition with a new id and timestamp. */
  duplicate(request: AutomationDuplicateRequest): AutomationDefinition | null {
    const source = this.get(request.id);
    if (!source) return null;
    const name = request.name ?? `${source.name}${STORE_PATHS.duplicateNameSuffix}`;
    if (name.length > AUTOMATION_LIMITS.maxNameLength) {
      throw createError(ErrorCode.INVALID_FORMAT, ERROR_MESSAGES.INVALID_FORMAT, 'duplicated automation name exceeds the length limit');
    }
    const now = Date.now();
    const copy: AutomationDefinition = {
      ...source,
      id: newAutomationId(),
      name,
      createdAt: now,
      updatedAt: now,
      graph: {
        nodes: source.graph.nodes.map((node) => ({ ...node, position: { ...node.position }, data: { ...node.data } })),
        edges: source.graph.edges.map((edge) => ({ ...edge })),
      },
      settings: { ...source.settings },
    };
    return this.save(copy);
  }

  /** Persists a previously validated portable export. */
  importDefinition(automation: AutomationDefinition): AutomationDefinition {
    return this.save(automation);
  }

  private load(): AutomationStoreData {
    const primary = this.readCandidate(this.filePath);
    if (primary) return primary;
    const backup = this.readCandidate(this.backupPath);
    if (!backup) return emptyStore();
    try {
      this.writeAtomic(this.filePath, JSON.stringify(backup, null, 2), false);
      log.info(LOG_AUTOMATION_STORE_RECOVERED);
    } catch (err) {
      log.warn(LOG_AUTOMATION_STORE_CORRUPT, describeError(err));
    }
    return backup;
  }

  private readCandidate(filePath: string): AutomationStoreData | null {
    try {
      if (!fs.existsSync(filePath)) return null;
      const stat = fs.statSync(filePath);
      if (!stat.isFile() || stat.size > AUTOMATION_LIMITS.maxFileBytes) {
        throw new Error('automation definitions file is not a bounded regular file');
      }
      return parseAutomationStoreJson(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      log.warn(LOG_AUTOMATION_STORE_CORRUPT, filePath, describeError(err));
      return null;
    }
  }

  private writeStore(store: AutomationStoreData): void {
    const raw = JSON.stringify(store, null, 2);
    if (raw.length > AUTOMATION_LIMITS.maxJsonChars) {
      throw createError(ErrorCode.INVALID_FORMAT, ERROR_MESSAGES.INVALID_FORMAT, 'automation definitions exceed the size limit');
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
}
