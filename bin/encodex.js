#!/usr/bin/env node
/**
 * @fileoverview CLI launcher for EncodeX.
 * Spawns the Electron binary with the project root as the app path so the CLI
 * can be invoked as `encodex` instead of `npx electron .`. All user-supplied
 * arguments are forwarded untouched to the app's main process, which detects
 * CLI mode and runs {@link ../src/main/cli.js runCli}.
 */

const { spawn } = require('child_process');
const path = require('path');

let electron;
try {
  electron = require('electron');
} catch {
  electron = 'electron';
}

const appPath = path.resolve(__dirname, '..');
const args = [appPath, ...process.argv.slice(2)];

const child = spawn(electron, args, { stdio: 'inherit' });

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('close', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
