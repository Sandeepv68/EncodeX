/**
 * @fileoverview Installs stdout protection before the MCP server modules load.
 *
 * Import this module first from the standalone entry point. It has no
 * dependencies that log, so evaluating it before `./run` keeps every
 * import-time log line off stdout.
 */

import { redirectConsoleLogToStderr } from '../shared/stdio-log-routing';

redirectConsoleLogToStderr();
