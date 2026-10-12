import { describe, it, expect, beforeEach } from 'vitest';
import { useAuditStore } from '../auditStore';
import type { AuditEntry } from '../../../shared/audit';

function makeEntry(tool: string): AuditEntry {
  return {
    id: `id-${tool}`,
    timestamp: '2026-01-01T00:00:00.000Z',
    tool,
    tier: 2,
    argsDigest: 'deadbeef',
    result: 'ok',
  };
}

describe('auditStore', () => {
  beforeEach(() => {
    useAuditStore.setState({ entries: [] });
  });

  it('starts with empty entries', () => {
    expect(useAuditStore.getState().entries).toEqual([]);
  });

  it('addEntry appends entries in order', () => {
    useAuditStore.getState().addEntry(makeEntry('convert_media'));
    useAuditStore.getState().addEntry(makeEntry('cut_video'));
    expect(useAuditStore.getState().entries.map((e) => e.tool)).toEqual(['convert_media', 'cut_video']);
  });

  it('caps entries at LOG_MAX_ENTRIES (2000)', () => {
    for (let i = 0; i < 2100; i += 1) {
      useAuditStore.getState().addEntry(makeEntry(`tool-${i}`));
    }
    const entries = useAuditStore.getState().entries;
    expect(entries).toHaveLength(2000);
    expect(entries[0].tool).toBe('tool-100');
    expect(entries[1999].tool).toBe('tool-2099');
  });

  it('clear empties the audit trail', () => {
    useAuditStore.getState().addEntry(makeEntry('convert_media'));
    useAuditStore.getState().clear();
    expect(useAuditStore.getState().entries).toEqual([]);
  });
});
