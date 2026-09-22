/**
 * @fileoverview Unit tests for analytics consent persistence.
 * Exercises read/write of `analytics-consent.json` inside a temp directory:
 * missing analytics file seeds from the monitoring consent file (and defaults
 * to enabled when that is also absent), explicit opt-out persists, corrupt JSON
 * degrades to the monitoring seed, and writes are idempotent.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ANALYTICS_CONSENT_FILENAME, readAnalyticsConsent, writeAnalyticsConsent } from '../consent';
import { MONITORING_CONSENT_FILENAME, writeMonitoringConsent } from '../../monitoring/consent';

describe('analytics consent', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-analytics-consent-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('defaults to enabled when neither consent file exists', () => {
    expect(readAnalyticsConsent(dir)).toBe(true);
  });

  it('seeds from an explicit monitoring opt-out when analytics is absent', () => {
    writeMonitoringConsent(dir, false);
    expect(readAnalyticsConsent(dir)).toBe(false);
  });

  it('seeds from an explicit monitoring opt-in when analytics is absent', () => {
    writeMonitoringConsent(dir, true);
    expect(readAnalyticsConsent(dir)).toBe(true);
  });

  it('reads an explicit opt-out', () => {
    writeAnalyticsConsent(dir, false);
    expect(JSON.parse(fs.readFileSync(path.join(dir, ANALYTICS_CONSENT_FILENAME), 'utf-8'))).toEqual({ enabled: false });
    expect(readAnalyticsConsent(dir)).toBe(false);
  });

  it('round-trips an explicit opt-in', () => {
    writeAnalyticsConsent(dir, true);
    expect(readAnalyticsConsent(dir)).toBe(true);
  });

  it('treats a corrupt analytics file as the monitoring seed', () => {
    fs.writeFileSync(path.join(dir, ANALYTICS_CONSENT_FILENAME), '{not json', 'utf-8');
    writeMonitoringConsent(dir, false);
    expect(readAnalyticsConsent(dir)).toBe(false);
  });

  it('creates the directory when missing on write', () => {
    const nested = path.join(dir, 'a', 'b');
    writeAnalyticsConsent(nested, false);
    expect(readAnalyticsConsent(nested)).toBe(false);
  });

  it('leaves the monitoring consent file untouched on write', () => {
    writeMonitoringConsent(dir, true);
    writeAnalyticsConsent(dir, false);
    expect(JSON.parse(fs.readFileSync(path.join(dir, MONITORING_CONSENT_FILENAME), 'utf-8'))).toEqual({ enabled: true });
  });
});
