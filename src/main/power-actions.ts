/**
 * @fileoverview OS power-action executor for the batch queue "when done" feature.
 *
 * Performs a shutdown, sleep, or hibernate action after the batch queue drains.
 * The command is platform-specific and spawned detached with stdio ignored and
 * unref'd, so it keeps running even if the Electron process exits, suspends, or
 * shuts down immediately after the call returns. On Windows the `force` flag is
 * honored by passing `shutdown /f` so applications are closed without
 * prompting; macOS and Linux do not expose a user-facing force-close switch for
 * these actions, so `force` is ignored there (the command already acts without
 * interaction).
 *
 * Platform commands:
 *  - Windows: `shutdown /s [/f] /t 0` for shutdown; `rundll32.exe
 *    powrprof.dll,SetSuspendState 0|1,1,0` for sleep/hibernate.
 *  - macOS: `osascript -e 'tell app "System Events" to shut down'` for shutdown;
 *    `pmset sleepnow` for both sleep and hibernate (macOS has no distinct user
 *    hibernate mode).
 *  - Linux: `systemctl poweroff` / `systemctl suspend` / `systemctl hibernate`.
 */

import { spawn } from 'child_process';
import { Logger } from '../shared/logger';
import type { WhenDoneAction } from '../shared/types';
import { LOG_WHEN_DONE_EXECUTING, LOG_WHEN_DONE_SPAWN_FAILED, LOG_WHEN_DONE_UNSUPPORTED_PLATFORM } from '../shared/log-constants';

const log = new Logger('main/power-actions');

/**
 * A fully resolved OS command to execute.
 * @interface PowerCommand
 * @property {string} command - The executable to spawn.
 * @property {string[]} args - Arguments passed to the executable.
 */
interface PowerCommand {
  command: string;
  args: string[];
}

/**
 * Resolves the platform-specific command that performs the given power action.
 * Returns null when the action cannot be performed on the current platform
 * (this never happens for the supported WhenDoneAction values, but keeps the
 * caller free of platform branches).
 * @param {WhenDoneAction} action - The power action to perform.
 * @param {boolean} force - Whether open processes should be force-closed (only
 *   honored on Windows shutdown).
 * @returns {PowerCommand | null} The command to spawn, or null when unsupported.
 */
function buildPowerCommand(action: WhenDoneAction, force: boolean): PowerCommand | null {
  if (process.platform === 'win32') {
    switch (action) {
      case 'shutdown':
        return { command: 'shutdown', args: force ? ['/s', '/f', '/t', '0'] : ['/s', '/t', '0'] };
      case 'sleep':
        return { command: 'rundll32.exe', args: ['powrprof.dll,SetSuspendState', '0', '1', '0'] };
      case 'hibernate':
        return { command: 'rundll32.exe', args: ['powrprof.dll,SetSuspendState', '1', '1', '0'] };
    }
  }
  if (process.platform === 'darwin') {
    switch (action) {
      case 'shutdown':
        return { command: 'osascript', args: ['-e', 'tell app "System Events" to shut down'] };
      case 'sleep':
      case 'hibernate':
        return { command: 'pmset', args: ['sleepnow'] };
    }
  }
  if (process.platform === 'linux') {
    switch (action) {
      case 'shutdown':
        return { command: 'systemctl', args: ['poweroff'] };
      case 'sleep':
        return { command: 'systemctl', args: ['suspend'] };
      case 'hibernate':
        return { command: 'systemctl', args: ['hibernate'] };
    }
  }
  return null;
}

/**
 * Performs the given power action by spawning the platform-specific command.
 *
 * The child process is spawned detached (its own process group), detached from
 * the terminal, with stdio ignored, and immediately unref'd so the Electron
 * main process can exit without waiting for it. Because the machine may sleep
 * or shut down before the Node event loop turns again, no async work is
 * performed after spawn - the action is fully fire-and-forget. Failures to
 * spawn are logged (the OS typically has these commands present) and swallowed.
 * @param {WhenDoneAction} action - The power action to perform.
 * @param {boolean} force - Whether open processes should be force-closed.
 * @returns {void}
 */
export function performPowerAction(action: WhenDoneAction, force: boolean): void {
  const cmd = buildPowerCommand(action, force);
  if (!cmd) {
    log.error(LOG_WHEN_DONE_UNSUPPORTED_PLATFORM, process.platform, action);
    return;
  }
  log.info(LOG_WHEN_DONE_EXECUTING, action, 'force:', force);
  try {
    const child = spawn(cmd.command, cmd.args, { detached: true, stdio: 'ignore' });
    child.unref();
  } catch (err) {
    log.error(LOG_WHEN_DONE_SPAWN_FAILED, err);
  }
}
