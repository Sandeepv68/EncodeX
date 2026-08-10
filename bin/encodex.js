#!/usr/bin/env node
/**
 * @fileoverview CLI launcher for EncodeX.
 * Spawns the Electron binary with the project root as the app path so the CLI
 * can be invoked as `encodex` instead of `npx electron .`. All user-supplied
 * arguments are forwarded untouched to the app's main process, which detects
 * CLI mode and runs {@link ../src/main/cli.js runCli}.
 *
 * Before spawning, this launcher pre-scans the arguments so environment-level
 * flags (`--verbose`, `--quiet`, `--no-color`) are visible to the Logger and
 * chalk, which read the environment at module load time.
 */

const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);

if (!process.env.LOG_LEVEL) {
  if (args.includes('--verbose')) process.env.LOG_LEVEL = 'DEBUG';
  else if (args.includes('--quiet')) process.env.LOG_LEVEL = 'WARN';
}
if (args.includes('--no-color')) process.env.NO_COLOR = '1';

let electron;
try {
  electron = require('electron');
} catch {
  electron = 'electron';
}

const appPath = path.resolve(__dirname, '..');
const child = spawn(electron, [appPath, ...args], { stdio: 'inherit' });

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('close', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
