import { describe, it, expect } from 'vitest';
import { filterPersonProperties, PERSON_PROPERTY_ALLOWLIST } from '../personProperties';

describe('personProperties', () => {
  it('keeps only allowlisted keys', () => {
    const out = filterPersonProperties({ app_version: '1.0', os: 'win32', evil: 'x', locale: 'en' });
    expect(out).toEqual({ app_version: '1.0', os: 'win32', locale: 'en' });
  });
  it('drops undefined values', () => {
    const out = filterPersonProperties({ app_version: undefined });
    expect(out).toEqual({});
  });
  it('allowlist contains the documented fields', () => {
    for (const key of ['app_version', 'os', 'arch', 'locale', 'channel', 'mode', 'hw_accel_available', 'first_seen_version', 'os_version', 'electron_version', 'node_version', 'environment']) {
      expect(PERSON_PROPERTY_ALLOWLIST.has(key)).toBe(true);
    }
  });
});
