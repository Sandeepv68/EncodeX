/**
 * @fileoverview Installs stdout protection for the Electron `--mcp` branch.
 *
 * Import this module first from the main-process entry point, before the rest
 * of the module graph is evaluated. Outside MCP mode it does nothing, so the
 * GUI and CLI keep their normal console routing.
 */

import { redirectConsoleLogToStderr } from '../shared/stdio-log-routing';

if (process.argv.includes('--mcp')) {
  redirectConsoleLogToStderr();
}
