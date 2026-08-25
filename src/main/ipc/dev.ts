/**
 * @fileoverview Dev-only IPC handlers for developer tooling.
 *
 * Currently provides a single channel, DEV_CAPTURE_SCREENSHOT, which captures
 * the main window's current contents via `webContents.capturePage()` and saves
 * them as a PNG under `<project root>/screenshots/dev/`. Handlers are only
 * registered when the app runs in development mode (NODE_ENV=development or
 * the `--dev` flag), matching the renderer-loading branch in main/index.ts;
 * in production builds no handler exists, so the channel is inert.
 */

import { BrowserWindow, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../shared/logger';
import { IPC } from '../../shared/ipc-channels';

const log = new Logger('main/ipc/dev');

/**
 * Project root that receives dev screenshots. Resolved by walking up from this
 * module's compiled location (`<root>/dist/main/ipc/dev.js`) to the nearest
 * ancestor containing a package.json. This is deterministic regardless of how
 * Electron is launched, unlike `app.getAppPath()`.
 */
function resolveProjectRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: repo root relative to the compiled file (<root>/dist/main/ipc).
  return path.resolve(__dirname, '..', '..', '..');
}

/** Directory name (relative to the project root) that receives dev screenshots. */
const SCREENSHOT_DIR = path.join('screenshots', 'dev');

/**
 * True when the app is running in development mode. Mirrors the check used by
 * main/index.ts to decide between the Vite dev server and the built renderer.
 * @returns {boolean} True when dev mode is active.
 */
export function isDevMode(): boolean {
  return process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
}

/**
 * Formats a timestamp for screenshot filenames, e.g. `20260824-141505`.
 * @param {Date} date - The timestamp to format.
 * @returns {string} The `YYYYMMDD-HHmmss` string.
 */
function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/**
 * Registers dev-only IPC handlers for the given window. A no-op outside of
 * development mode so production builds never expose these channels.
 *
 * @param {BrowserWindow} win - The window whose contents are captured.
 * @returns {void} Nothing is returned.
 */
export function registerDevHandlers(win: BrowserWindow): void {
  if (!isDevMode()) {
    log.debug('Dev handlers skipped (not running in development mode)');
    return;
  }

  /**
   * Handles IPC.DEV_CAPTURE_SCREENSHOT (dev-capture-screenshot).
   * Captures the current window contents and writes them to
   * `<project root>/screenshots/dev/encodex-dev-<timestamp>.png`, creating the
   * directory on first use.
   *
   * @returns {Promise<string>} Resolves with the absolute path of the saved PNG.
   * @throws {Error} When the capture fails or the image cannot be written.
   */
  ipcMain.handle(IPC.DEV_CAPTURE_SCREENSHOT, async () => {
    if (win.isDestroyed()) {
      throw new Error('Cannot capture screenshot: main window is destroyed');
    }
    const image = await win.webContents.capturePage();
    const outDir = path.join(resolveProjectRoot(), SCREENSHOT_DIR);
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `encodex-dev-${formatTimestamp(new Date())}.png`);
    fs.writeFileSync(outPath, image.toPNG());
    log.info('Dev screenshot saved:', outPath);
    return outPath;
  });
}
