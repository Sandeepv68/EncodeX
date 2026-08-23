/**
 * @fileoverview Unit tests for monitoring consent persistence.
 * Exercises read/write of `monitoring-consent.json` inside a temp directory:
 * missing file defaults to enabled, explicit opt-out persists, corrupt JSON
 * degrades to enabled, and writes are idempotent.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MONITORING_CONSENT_FILENAME, readMonitoringConsent, writeMonitoringConsent } from '../consent';

describe('monitoring consent', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-consent-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('defaults to enabled when no consent file exists', () => {
    expect(readMonitoringConsent(dir)).toBe(true);
  });

  it('reads an explicit opt-out', () => {
    writeMonitoringConsent(dir, false);
    expect(JSON.parse(fs.readFileSync(path.join(dir, MONITORING_CONSENT_FILENAME), 'utf-8'))).toEqual({ enabled: false });
    expect(readMonitoringConsent(dir)).toBe(false);
  });

  it('round-trips an explicit opt-in', () => {
    writeMonitoringConsent(dir, true);
    expect(readMonitoringConsent(dir)).toBe(true);
  });

  it('treats a corrupt file as enabled', () => {
    fs.writeFileSync(path.join(dir, MONITORING_CONSENT_FILENAME), '{not json', 'utf-8');
    expect(readMonitoringConsent(dir)).toBe(true);
  });

  it('creates the directory when missing on write', () => {
    const nested = path.join(dir, 'a', 'b');
    writeMonitoringConsent(nested, false);
    expect(readMonitoringConsent(nested)).toBe(false);
  });
});
