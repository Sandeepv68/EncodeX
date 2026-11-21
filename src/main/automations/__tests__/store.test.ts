import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { expectAppLog } from '../../../test-utils/crash-tripwire';
import { AutomationStore, buildAutomationExport } from '../store';
import { createAutomationDefinition } from '../../../shared/automations/defaults';
import { AUTOMATION_LIMITS, AUTOMATION_STORE } from '../../../shared/automations/limits';
import { parseAutomationExportJson } from '../../../shared/automations/schema';

describe('AutomationStore', () => {
  let userDataDir: string;
  let definitionsPath: string;
  let backupPath: string;

  beforeEach(() => {
    userDataDir = mkdtempSync(join(tmpdir(), 'encodex-automation-store-'));
    definitionsPath = join(userDataDir, AUTOMATION_STORE.directory, AUTOMATION_STORE.filename);
    backupPath = `${definitionsPath}${AUTOMATION_STORE.backupSuffix}`;
  });

  afterEach(() => {
    rmSync(userDataDir, { recursive: true, force: true });
  });

  it('persists, updates, duplicates, and deletes definitions atomically', () => {
    const store = new AutomationStore(userDataDir);
    expect(store.list()).toEqual([]);

    const first = store.save(createAutomationDefinition('a', 'First', 1000));
    expect(existsSync(definitionsPath)).toBe(true);
    expect(store.list()).toEqual([first]);

    const updated = store.save({ ...first, name: 'Renamed', updatedAt: 2000 });
    expect(store.get('a')).toEqual(updated);
    expect(existsSync(backupPath)).toBe(true);

    const copy = store.duplicate({ id: 'a', name: 'Copy' });
    expect(copy).not.toBeNull();
    expect(copy?.id).not.toBe('a');
    expect(copy?.name).toBe('Copy');
    expect(store.list()).toHaveLength(2);

    expect(store.delete('a')).toBe(true);
    expect(store.delete('a')).toBe(false);
    expect(store.get('a')).toBeNull();
    expect(readdirSync(join(userDataDir, AUTOMATION_STORE.directory)).some((name) => name.endsWith('.tmp'))).toBe(false);
  });

  it('recovers the last valid snapshot from backup when the primary file is corrupt', () => {
    const store = new AutomationStore(userDataDir);
    store.save(createAutomationDefinition('a', 'Original', 1000));
    store.save(createAutomationDefinition('b', 'Replacement', 2000));

    writeFileSync(definitionsPath, '{ not json', 'utf8');
    expectAppLog('warn', 'main/automations/store');
    const recovered = new AutomationStore(userDataDir).list();

    expect(recovered.map((definition) => definition.id)).toEqual(['a']);
    expect(JSON.parse(readFileSync(definitionsPath, 'utf8')).automations[0].id).toBe('a');
  });

  it('returns an empty list when both snapshots are invalid', () => {
    const directory = join(userDataDir, AUTOMATION_STORE.directory);
    mkdirSync(directory, { recursive: true });
    writeFileSync(definitionsPath, '[]', 'utf8');
    writeFileSync(backupPath, '{', 'utf8');
    expectAppLog('warn', 'main/automations/store');
    expectAppLog('warn', 'main/automations/store');
    expect(new AutomationStore(userDataDir).list()).toEqual([]);
    expect(readdirSync(directory)).toHaveLength(2);
  });

  it('rejects oversized strings and duplicate names over the length limit', () => {
    const store = new AutomationStore(userDataDir);
    const tooLong = 'x'.repeat(AUTOMATION_LIMITS.maxNameLength + 1);
    expect(() => store.save(createAutomationDefinition('a', tooLong, 1000))).toThrow();

    store.save(createAutomationDefinition('a', 'Original', 1000));
    expect(() => store.duplicate({ id: 'a', name: tooLong })).toThrow();
  });

  it('builds an export envelope that parses back to the original definition', () => {
    const definition = createAutomationDefinition('a', 'Portable', 1000);
    const envelope = buildAutomationExport(definition, 2000);
    expect(parseAutomationExportJson(JSON.stringify(envelope))).toEqual(envelope);
  });
});
