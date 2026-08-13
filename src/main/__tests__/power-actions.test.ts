import { describe, it, expect, vi, afterEach } from 'vitest';
import { spawn } from 'child_process';
import type { WhenDoneAction } from '../../shared/types';

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(() => ({ unref: vi.fn() })),
}));

vi.mock('child_process', () => ({
  spawn: spawnMock,
  default: { spawn: spawnMock },
}));

const { performPowerAction } = await import('../power-actions');

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
}

describe('performPowerAction', () => {
  afterEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
  });

  function expectSpawned(command: string, args: string[]): void {
    expect(spawnMock).toHaveBeenCalledWith(command, args, { detached: true, stdio: 'ignore' });
    expect(spawnMock).toHaveBeenCalledTimes(1);
  }

  function lastChildUnref(): void {
    expect(spawnMock.mock.results[0].value.unref).toHaveBeenCalledOnce();
  }

  it.each<{ action: WhenDoneAction; force: boolean; command: string; args: string[] }>([
    { action: 'shutdown', force: false, command: 'shutdown', args: ['/s', '/t', '0'] },
    { action: 'shutdown', force: true, command: 'shutdown', args: ['/s', '/f', '/t', '0'] },
    { action: 'sleep', force: false, command: 'rundll32.exe', args: ['powrprof.dll,SetSuspendState', '0', '1', '0'] },
    { action: 'hibernate', force: false, command: 'rundll32.exe', args: ['powrprof.dll,SetSuspendState', '1', '1', '0'] },
  ])('windows: $action (force=$force) spawns the right command', ({ action, force, command, args }) => {
    setPlatform('win32');
    performPowerAction(action, force);
    expectSpawned(command, args);
    lastChildUnref();
  });

  it.each<{ action: WhenDoneAction; command: string; args: string[] }>([
    { action: 'shutdown', command: 'osascript', args: ['-e', 'tell app "System Events" to shut down'] },
    { action: 'sleep', command: 'pmset', args: ['sleepnow'] },
    { action: 'hibernate', command: 'pmset', args: ['sleepnow'] },
  ])('macos: $action spawns the right command', ({ action, command, args }) => {
    setPlatform('darwin');
    performPowerAction(action, false);
    expectSpawned(command, args);
  });

  it.each<{ action: WhenDoneAction; command: string; args: string[] }>([
    { action: 'shutdown', command: 'systemctl', args: ['poweroff'] },
    { action: 'sleep', command: 'systemctl', args: ['suspend'] },
    { action: 'hibernate', command: 'systemctl', args: ['hibernate'] },
  ])('linux: $action spawns the right command', ({ action, command, args }) => {
    setPlatform('linux');
    performPowerAction(action, false);
    expectSpawned(command, args);
  });

  it('logs and skips on unsupported platforms without throwing', () => {
    setPlatform('freebsd');
    expect(() => performPowerAction('shutdown', false)).not.toThrow();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('never awaits or keeps the app alive (unref called on every spawn)', () => {
    setPlatform('win32');
    performPowerAction('sleep', true);
    lastChildUnref();
  });
});
