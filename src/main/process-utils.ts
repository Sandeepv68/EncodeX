/**
 * @fileoverview Process utility functions for pausing and resuming system
 * processes. Provides cross-platform process suspension capabilities.
 *
 * On Windows, suspension is implemented by injecting a small P/Invoke snippet
 * via `powershell -EncodedCommand` that calls `NtSuspendProcess` /
 * `NtResumeProcess` from ntdll.dll. On POSIX platforms the same effect is
 * achieved with the `SIGSTOP` / `SIGCONT` signals.
 *
 * Exports:
 *  - suspendProcess() - pauses a process by PID
 *  - resumeProcess()  - resumes a previously paused process by PID
 *
 * Neither function rejects; failures are logged and the returned promise always
 * resolves so callers never have to handle suspension errors inline.
 */

import { exec } from 'child_process';
import { Logger } from '../shared/logger';
import { PROCESS_SUSPEND_SIGNAL, PROCESS_RESUME_SIGNAL } from '../shared/constants';
import {
  LOG_FAILED_TO_RESUME_PROCESS,
  LOG_FAILED_TO_SUSPEND_PROCESS,
  LOG_PROCESS_RESUMED,
  LOG_PROCESS_SUSPENDED,
} from '../shared/log-constants';

/**
 * Logger instance scoped to the process utilities module. Logs suspend/resume
 * attempts and any failures encountered while running the platform-specific
 * suspend commands.
 * @const {Logger} log
 */
const log = new Logger('main/process-utils');

/**
 * Builds a base64-encoded PowerShell command that suspends or resumes a process
 * by PID using the native `NtSuspendProcess` / `NtResumeProcess` calls.
 *
 * The generated script defines a `ProcUtil` class with P/Invoke declarations
 * into ntdll.dll, looks up the process by PID, and calls the requested native
 * method with its handle. The UTF-16LE script is base64-encoded for
 * `-EncodedCommand` so quoting/escaping issues are avoided.
 *
 * @param {number} pid - The process ID to target.
 * @param {boolean} suspend - `true` to suspend, `false` to resume.
 * @returns {string} A complete
 *   `powershell -NoProfile -NonInteractive -EncodedCommand <base64>` command
 *   string.
 */
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

/**
 * Suspends a process by PID, using the native NT API on Windows and `SIGSTOP`
 * on POSIX platforms.
 *
 * On Windows the PowerShell command is spawned via `exec`; on POSIX,
 * `process.kill(pid, PROCESS_SUSPEND_SIGNAL)` is used. Failures are logged as
 * warnings and do not reject the returned promise.
 *
 * @param {number} pid - The process ID to suspend.
 * @returns {Promise<void>} Resolves once the suspend attempt completes,
 *   regardless of success or failure.
 */
export function suspendProcess(pid: number): Promise<void> {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec(buildPowerShellCommand(pid, true), (err) => {
        if (err) log.warn(LOG_FAILED_TO_SUSPEND_PROCESS, err.message);
        else log.info(LOG_PROCESS_SUSPENDED, pid);
        resolve();
      });
    } else {
      try {
        process.kill(pid, PROCESS_SUSPEND_SIGNAL);
        log.info(LOG_PROCESS_SUSPENDED, pid);
      } catch (err) {
        log.warn(LOG_FAILED_TO_SUSPEND_PROCESS, err);
      }
      resolve();
    }
  });
}

/**
 * Resumes a previously suspended process by PID, using the native NT API on
 * Windows and `SIGCONT` on POSIX platforms.
 *
 * On Windows the PowerShell command is spawned via `exec`; on POSIX,
 * `process.kill(pid, PROCESS_RESUME_SIGNAL)` is used. Failures are logged as
 * warnings and do not reject the returned promise.
 *
 * @param {number} pid - The process ID to resume.
 * @returns {Promise<void>} Resolves once the resume attempt completes,
 *   regardless of success or failure.
 */
export function resumeProcess(pid: number): Promise<void> {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec(buildPowerShellCommand(pid, false), (err) => {
        if (err) log.warn(LOG_FAILED_TO_RESUME_PROCESS, err.message);
        else log.info(LOG_PROCESS_RESUMED, pid);
        resolve();
      });
    } else {
      try {
        process.kill(pid, PROCESS_RESUME_SIGNAL);
        log.info(LOG_PROCESS_RESUMED, pid);
      } catch (err) {
        log.warn(LOG_FAILED_TO_RESUME_PROCESS, err);
      }
      resolve();
    }
  });
}
