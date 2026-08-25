#!/usr/bin/env node
/**
 * @fileoverview Automated screenshot capture for all EncodeX screens.
 *
 * Launches the built Electron app through Playwright's `_electron` API using
 * the e2e mock preload (`ENCODEX_TEST_MODE=1`) so runs are deterministic and
 * never touch real files, FFmpeg jobs, or update dialogs. It then walks every
 * route in the app (via the sidebar nav items) and saves a full-window PNG of
 * each screen into the output directory.
 *
 * Usage:
 *   node scripts/capture-screens.mjs [options]
 *
 * Options:
 *   --out <dir>      Output directory (default: "screenshots")
 *   --themes <list>  Comma-separated theme ids to capture (default: current
 *                    theme only). Valid ids: light,ocean,sunset,forest,
 *                    lavender,rose,slate,dark
 *   --width <n>      Window width in px (default: 1280)
 *   --height <n>     Window height in px (default: 800)
 *   --delay <ms>     Extra settle time after each navigation (default: 500)
 *
 * Examples:
 *   node scripts/capture-screens.mjs
 *   node scripts/capture-screens.mjs --themes light,dark --out docs/shots
 */

import { _electron } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Every route in App.tsx mapped to its sidebar nav item test id. */
const PAGES = [
  { name: 'dashboard', path: '/', nav: 'nav-item-dashboard' },
  { name: 'convert', path: '/convert', nav: 'nav-item-convert' },
  { name: 'media-info', path: '/media-info', nav: 'nav-item-media-info' },
  { name: 'image-compress', path: '/image-compress', nav: 'nav-item-image-compress' },
  { name: 'audio-extract', path: '/audio-extract', nav: 'nav-item-audio-extract' },
  { name: 'video-cut', path: '/video-cut', nav: 'nav-item-video-cut' },
  { name: 'batch', path: '/batch', nav: 'nav-item-batch' },
  { name: 'logs', path: '/logs', nav: 'nav-item-logs' },
  { name: 'settings', path: '/settings', nav: 'nav-item-settings' },
  { name: 'about', path: '/about', nav: 'nav-item-about' },
];

const VALID_THEMES = ['light', 'ocean', 'sunset', 'forest', 'lavender', 'rose', 'slate', 'dark'];

function parseArgs(argv) {
  const opts = {
    out: 'screenshots',
    themes: null,
    width: 1280,
    height: 800,
    delay: 500,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[++i];
    };
    switch (arg) {
      case '--out':
        opts.out = next();
        break;
      case '--themes':
        opts.themes = next()
          .split(',')
          .map((t) => t.trim());
        break;
      case '--width':
        opts.width = Number(next());
        break;
      case '--height':
        opts.height = Number(next());
        break;
      case '--delay':
        opts.delay = Number(next());
        break;
      case '--help':
      case '-h':
        console.log('See header comment in scripts/capture-screens.mjs for usage.');
        process.exit(0);
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (opts.themes) {
    for (const t of opts.themes) {
      if (!VALID_THEMES.includes(t)) {
        throw new Error(`Invalid theme "${t}". Valid themes: ${VALID_THEMES.join(', ')}`);
      }
    }
  }
  return opts;
}

function requireBuild(root) {
  const required = ['dist/main/index.js', 'dist/preload/index.js', 'dist/renderer/index.html'];
  const missing = required.filter((rel) => !fs.existsSync(path.join(root, rel)));
  if (missing.length > 0) {
    throw new Error(`Build artifacts missing: ${missing.join(', ')}\nRun "npm run build" first.`);
  }
}

async function launchApp(opts) {
  const root = path.resolve(__dirname, '..');
  requireBuild(root);

  // Isolated user-data dir keeps the real profile untouched.
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-shots-'));

  const env = { ...process.env, ENCODEX_TEST_MODE: '1' };

  const app = await _electron.launch({
    args: [path.join(root, 'dist', 'main', 'index.js'), `--user-data-dir=${userDataDir}`],
    cwd: root,
    env,
  });

  const page = await findMainWindow(app);
  // Resize the native window (setViewportSize does not work on Electron).
  await app.evaluate(
    ({ BrowserWindow }, { width, height }) => {
      const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w.webContents.getURL());
      win?.setSize(width, height);
    },
    { width: opts.width, height: opts.height },
  );
  return { app, page, userDataDir, root };
}

async function findMainWindow(app) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    for (const win of app.windows()) {
      try {
        const hasApi = await win.evaluate(() => typeof window.electronAPI !== 'undefined');
        if (hasApi) return win;
      } catch {
        /* window may have closed; skip */
      }
    }
    await sleep(250);
  }
  throw new Error('Main window (with electronAPI) was not found');
}

async function navigateTo(page, target) {
  // Prefer clicking the real sidebar item; fall back to direct hash navigation.
  const navItem = page.locator(`[data-testid="${target.nav}"]`);
  if ((await navItem.count()) > 0) {
    await navItem.first().click({ timeout: 10000 });
  } else {
    await page.evaluate((hashPath) => {
      window.location.hash = `#${hashPath}`;
    }, target.path);
  }
  await page.waitForFunction((p) => window.location.hash.startsWith(`#${p}`), target.path, {
    timeout: 15000,
  });
}

/**
 * Switches the active theme by driving the Settings page theme cards, then
 * navigates back to the dashboard.
 */
async function applyTheme(page, themeId) {
  await navigateTo(
    page,
    PAGES.find((p) => p.name === 'settings'),
  );
  const card = page.locator(`[data-testid="settings-theme-${themeId}"]`);
  await card.waitFor({ timeout: 15000 });
  if ((await card.getAttribute('aria-pressed')) !== 'true') {
    await card.click();
    await expectAriaPressed(card, true);
  }
}

async function expectAriaPressed(locator, expected) {
  await locator.waitFor({ timeout: 15000 });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if ((await locator.getAttribute('aria-pressed')) === String(expected)) return;
    await sleep(200);
  }
  throw new Error('Theme card did not become active');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(opts.out);
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Launching EncodeX...');
  const { app, page, userDataDir } = await launchApp(opts);
  let exitCode = 0;

  try {
    // Wait for the shell to finish mounting before interacting.
    await page.locator('[data-testid="nav-item-dashboard"]').waitFor({ timeout: 30000 });
    await sleep(800);

    const themes = opts.themes ?? [null];
    for (const theme of themes) {
      if (theme) {
        console.log(`Switching theme to "${theme}"...`);
        await applyTheme(page, theme);
      }
      const suffix = theme ? `-${theme}` : '';
      for (const target of PAGES) {
        await navigateTo(page, target);
        await sleep(opts.delay); // allow lazy chunk load + MUI transitions to settle
        const file = path.join(outDir, `${target.name}${suffix}.png`);
        await page.screenshot({ path: file, fullPage: false });
        console.log(`Captured ${path.relative(process.cwd(), file)}`);
      }
    }
    console.log(`\nDone. ${PAGES.length * themes.length} screenshots saved to ${outDir}`);
  } catch (err) {
    console.error('\nScreenshot run failed:', err.message || err);
    exitCode = 1;
  } finally {
    // Best-effort teardown: close, then force-kill if needed, then clean temp dir.
    try {
      const pid = app.process().pid;
      await Promise.race([app.close(), sleep(5000)]);
      if (pid && process.platform === 'win32') {
        try {
          execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
        } catch {
          /* already dead */
        }
      }
    } catch {
      /* ignore teardown issues */
    }
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  }

  process.exit(exitCode);
}

main();
