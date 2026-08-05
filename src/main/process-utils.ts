/**
 * @fileoverview Process utility functions for pausing and resuming system processes.
 * Provides cross-platform process suspension capabilities.
 */

import { exec } from 'child_process';
import { Logger } from '../shared/logger';
import { PROCESS_SUSPEND_SIGNAL, PROCESS_RESUME_SIGNAL } from '../shared/constants';

const log = new Logger('main/process-utils');

function buildPowerShellCommand(pid: number, suspend: boolean): string {
  const method = suspend ? 'NtSuspendProcess' : 'NtResumeProcess';
  const script = [
    "Add-Type @'",
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class ProcUtil {',
    '    [DllImport("ntdll.dll")]',
    '    public static extern int NtSuspendProcess(IntPtr hProcess);',
    '    [DllImport("ntdll.dll")]',
    '    public static extern int NtResumeProcess(IntPtr hProcess);',
    '}',
    "'@;",
    `$p=[System.Diagnostics.Process]::GetProcessById(${pid});`,
    `[ProcUtil]::${method}($p.Handle);`,
  ].join('\n');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return `powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`;
}

export function suspendProcess(pid: number): Promise<void> {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec(buildPowerShellCommand(pid, true), (err) => {
        if (err) log.warn('Failed to suspend process:', err.message);
        else log.info('Process suspended:', pid);
        resolve();
      });
    } else {
      try {
        process.kill(pid, PROCESS_SUSPEND_SIGNAL);
        log.info('Process suspended:', pid);
      } catch (err) {
        log.warn('Failed to suspend process:', err);
      }
      resolve();
    }
  });
}

export function resumeProcess(pid: number): Promise<void> {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec(buildPowerShellCommand(pid, false), (err) => {
        if (err) log.warn('Failed to resume process:', err.message);
        else log.info('Process resumed:', pid);
        resolve();
      });
    } else {
      try {
        process.kill(pid, PROCESS_RESUME_SIGNAL);
        log.info('Process resumed:', pid);
      } catch (err) {
        log.warn('Failed to resume process:', err);
      }
      resolve();
    }
  });
}
