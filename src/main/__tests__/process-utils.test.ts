import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { execMock } = vi.hoisted(() => ({ execMock: vi.fn() }));

vi.mock('child_process', () => ({
  default: { exec: execMock },
  exec: execMock,
}));

import { suspendProcess, resumeProcess } from '../process-utils';

const ORIGINAL_PLATFORM = process.platform;

describe('process-utils', () => {
  beforeEach(() => {
    execMock.mockReset();
    Object.defineProperty(process, 'platform', { value: ORIGINAL_PLATFORM });
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: ORIGINAL_PLATFORM });
    vi.restoreAllMocks();
  });

  it('suspendProcess runs a PowerShell NtSuspendProcess command on win32', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    execMock.mockImplementation((_cmd: string, cb: (err: Error | null) => void) => cb(null));
    const killSpy = vi.spyOn(process, 'kill');
    await suspendProcess(1234);
    expect(execMock).toHaveBeenCalledOnce();
    const cmd = execMock.mock.calls[0][0] as string;
    const encoded = cmd.split('EncodedCommand ')[1];
    const decoded = Buffer.from(encoded, 'base64').toString('utf16le');
    expect(decoded).toContain('NtSuspendProcess');
    expect(decoded).toContain('1234');
    expect(killSpy).not.toHaveBeenCalled();
  });

  it('suspendProcess logs a warning when the command errors', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    execMock.mockImplementation((_cmd: string, cb: (err: Error | null) => void) => cb(new Error('boom')));
    await suspendProcess(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[WARN]'),
      expect.stringContaining('Failed to suspend process:'),
      expect.stringContaining('boom'),
    );
    warnSpy.mockRestore();
  });

  it('suspendProcess sends SIGSTOP on non-win32 platforms', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);
    await suspendProcess(99);
    expect(execMock).not.toHaveBeenCalled();
    expect(killSpy).toHaveBeenCalledWith(99, 'SIGSTOP');
  });

  it('suspendProcess logs a warning when SIGSTOP throws', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('nope');
    });
    await suspendProcess(7);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[WARN]'),
      expect.stringContaining('Failed to suspend process:'),
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  it('resumeProcess runs a PowerShell NtResumeProcess command on win32', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    execMock.mockImplementation((_cmd: string, cb: (err: Error | null) => void) => cb(null));
    const killSpy = vi.spyOn(process, 'kill');
    await resumeProcess(555);
    expect(execMock).toHaveBeenCalledOnce();
    const cmd = execMock.mock.calls[0][0] as string;
    const encoded = cmd.split('EncodedCommand ')[1];
    const decoded = Buffer.from(encoded, 'base64').toString('utf16le');
    expect(decoded).toContain('NtResumeProcess');
    expect(decoded).toContain('555');
    expect(killSpy).not.toHaveBeenCalled();
  });

  it('resumeProcess logs a warning when the resume command errors', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    execMock.mockImplementation((_cmd: string, cb: (err: Error | null) => void) => cb(new Error('boom')));
    await resumeProcess(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[WARN]'),
      expect.stringContaining('Failed to resume process:'),
      expect.stringContaining('boom'),
    );
    warnSpy.mockRestore();
  });

  it('resumeProcess sends SIGCONT on non-win32 platforms', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);
    await resumeProcess(88);
    expect(execMock).not.toHaveBeenCalled();
    expect(killSpy).toHaveBeenCalledWith(88, 'SIGCONT');
  });
});
