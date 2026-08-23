/**
 * @fileoverview Unit tests for the monitoring IPC bridge.
 * Uses a captured-handler mock of `ipcMain.handle` to exercise the two
 * channels end-to-end: state reporting, consent persistence to disk, live
 * facade toggling, and coercion of non-boolean payloads to "off".
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const handleSpy = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  ipcMain: { handle: handleSpy },
}));

const setEnabledMock = vi.hoisted(() => vi.fn());
const getBackendNameMock = vi.hoisted(() => vi.fn());

vi.mock('../../../shared/monitoring/MonitoringService', () => ({
  setMonitoringEnabled: setEnabledMock,
  getMonitoringBackendName: getBackendNameMock,
}));

import { IPC } from '../../../shared/ipc-channels';
import { MONITORING_CONSENT_FILENAME } from '../consent';
import { registerMonitoringIpcBridge } from '../ipcBridge';
import type { MonitoringState } from '../types';

describe('registerMonitoringIpcBridge', () => {
  let dir: string;
  let handlers: Map<string, (...args: unknown[]) => unknown>;

  const readConsentFile = (): { enabled: boolean } | null =>
    JSON.parse(fs.readFileSync(path.join(dir, MONITORING_CONSENT_FILENAME), 'utf-8'));

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-ipcbridge-'));
    handlers = new Map();
    handleSpy.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => handlers.set(channel, handler));
    setEnabledMock.mockResolvedValue(undefined);
    getBackendNameMock.mockReturnValue('sentry');
    registerMonitoringIpcBridge({ userDataDir: dir, consentEnabled: true });
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('registers exactly the two monitoring channels', () => {
    expect([...handlers.keys()].sort()).toEqual([IPC.MONITORING_GET_STATE, IPC.MONITORING_SET_ENABLED].sort());
  });

  it('reports bootstrap consent and the active backend name', () => {
    const state = handlers.get(IPC.MONITORING_GET_STATE)!() as MonitoringState;
    expect(state).toEqual({ enabled: true, backend: 'sentry' });
  });

  it('persists opt-out, toggles the facade, and reports the new state', async () => {
    const setter = handlers.get(IPC.MONITORING_SET_ENABLED)!;
    const state = (await setter({}, false)) as MonitoringState;

    expect(readConsentFile()).toEqual({ enabled: false });
    expect(setEnabledMock).toHaveBeenCalledWith(false);
    expect(state).toEqual({ enabled: false, backend: 'sentry' });
    expect(handlers.get(IPC.MONITORING_GET_STATE)!()).toEqual({ enabled: false, backend: 'sentry' });
  });

  it('round-trips back to enabled', async () => {
    const setter = handlers.get(IPC.MONITORING_SET_ENABLED)!;
    await setter({}, false);
    const state = (await setter({}, true)) as MonitoringState;

    expect(readConsentFile()).toEqual({ enabled: true });
    expect(setEnabledMock).toHaveBeenLastCalledWith(true);
    expect(state.enabled).toBe(true);
  });

  it('coerces non-boolean truthiness to explicit boolean states', async () => {
    const setter = handlers.get(IPC.MONITORING_SET_ENABLED)!;
    await setter({}, 'yes');
    expect(readConsentFile()).toEqual({ enabled: false });
    expect(setEnabledMock).toHaveBeenLastCalledWith(false);

    await setter({}, true);
    expect(readConsentFile()).toEqual({ enabled: true });
    expect(setEnabledMock).toHaveBeenLastCalledWith(true);
  });
});
