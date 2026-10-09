/**
 * @fileoverview W9 e2e spec driving the *visible* VS Code MCP UI against the
 * canonical VS Code MCP config.
 *
 * Launches a real VS Code binary (`Code.exe`) with a throwaway user-data dir
 * pointed at a scratch workspace whose `.vscode/mcp.json` is a verbatim copy of
 * the canonical one (`e2e/mcp/fixtures/vscode-mcp.json`, tracked because
 * `.vscode/` is gitignored). A standalone EncodeX MCP HTTP server (no auth, on
 * the exact loopback port the config names) runs behind it. Then it drives the
 * command palette's `MCP: List Servers` quick pick: asserts the `encodex` entry
 * appears sourced from `.vscode/mcp.json`, and that selecting `Start Server`
 * flips its UI status from `Stopped` to `Running` - the user-visible proof that
 * the real client connects to the real shipped endpoint.
 *
 * This complements the tier-A (node) half `e2e/mcp/vscode-client.spec.ts` and
 * is a Tier B spec (real preload, real main process) for
 * `e2e/vitest.e2e.real.config.ts`. It skips on machines without a VS Code
 * install and is not part of the mock-preload config.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Page } from 'playwright';
import { getBuildPaths } from '../helpers';
import { startHttpServer, stopProcess, VSCODE_MCP_FIXTURE_PATH } from './harness';
import type { HttpServerHarness } from './harness';

const IS_REAL = process.env.E2E_REAL === '1';
const MCP_PORT = 8765;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolves the real VS Code executable, preferring an env override. */
function resolveVscodeExecutable(): string | null {
  const localAppData = process.env.LOCALAPPDATA;
  const home = os.homedir();
  const candidates = [
    process.env.VSCODE_EXE,
    localAppData ? path.join(localAppData, 'Programs', 'Microsoft VS Code', 'Code.exe') : undefined,
    path.join(home, 'AppData', 'Local', 'Programs', 'Microsoft VS Code', 'Code.exe'),
    path.join('C:', 'Program Files', 'Microsoft VS Code', 'Code.exe'),
    path.join('C:', 'Program Files (x86)', 'Microsoft VS Code', 'Code.exe'),
  ].filter((candidate): candidate is string => typeof candidate === 'string');
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

const VSCODE_EXECUTABLE = resolveVscodeExecutable();

interface QuickPickRow {
  i: number;
  text: string;
  aria: string;
  box: { x: number; y: number; w: number; h: number } | null;
  visible: boolean;
}

/** Reads every rendered quick-pick row with its on-screen bounding box. */
async function readQuickPickRows(window: Page): Promise<QuickPickRow[]> {
  return window.evaluate(() => {
    const out: Array<{ i: number; text: string; aria: string; box: unknown; visible: boolean }> = [];
    document.querySelectorAll('.quick-input-list .monaco-list-row').forEach((el, i) => {
      let box: { x: number; y: number; w: number; h: number } | null = null;
      try {
        const b = el.getBoundingClientRect();
        if (b.width > 0 && b.height > 0) box = { x: b.x, y: b.y, w: b.width, h: b.height };
      } catch {
        /* off-DOM row */
      }
      out.push({
        i,
        text: (el as HTMLElement).innerText.replace(/\n/g, ' | '),
        aria: el.getAttribute('aria-label') ?? '',
        box,
        visible: box !== null,
      });
    });
    return out;
  }) as Promise<QuickPickRow[]>;
}

/**
 * Clicks a visible quick-pick row by raw mouse coordinates. Monaco's list rows
 * are frequently flagged "not visible"/box-less to Playwright's actionability
 * gate, so we read bounding boxes from the DOM and click at their centres -
 * the same technique that empirically drives the server list reliably.
 */
async function clickRow(window: Page, matches: (row: QuickPickRow) => boolean, label: string): Promise<void> {
  let last: QuickPickRow[] = [];
  for (let attempt = 0; attempt < 6; attempt++) {
    last = await readQuickPickRows(window);
    const target = last.find((row) => row.visible && matches(row));
    if (target?.box) {
      await window.mouse.click(target.box.x + 30, target.box.y + target.box.h / 2);
      return;
    }
    await sleep(700);
  }
  throw new Error(`quick-pick row "${label}" was never clickable (rows: ${JSON.stringify(last)})`);
}

/** Opens the command palette with the given query, typing char-by-char. */
async function openPalette(window: Page, query: string): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt++) {
    await window.keyboard.press('Escape').catch(() => {});
    await sleep(300);
    await window.keyboard.press('Control+Shift+P').catch(() => {});
    await sleep(1500);
    const box = window.locator('.quick-input-box input');
    if ((await box.count()) !== 1) continue;
    for (const ch of query) {
      await window.keyboard.type(ch, { delay: 80 });
      await sleep(90);
    }
    await sleep(400);
    const value = await box.inputValue().catch(() => '');
    if (value.startsWith('>' + query)) return;
    await window.keyboard.press('Escape').catch(() => {});
  }
  throw new Error(`command palette never accepted query "${query}"`);
}

/** Runs the "MCP: List Servers" command and waits for the server picker. */
async function runMcpListServers(window: Page): Promise<void> {
  await openPalette(window, 'mcp');
  await sleep(500);
  await clickRow(window, (row) => /list servers/i.test(row.text), 'MCP: List Servers');
  await sleep(2500);
  const rows = await readQuickPickRows(window);
  if (!rows.some((row) => /encodex/i.test(row.text) && row.text.includes('/.vscode/mcp.json'))) {
    throw new Error(`MCP server list never appeared (rows: ${JSON.stringify(rows)})`);
  }
}

describe.runIf(IS_REAL && !!VSCODE_EXECUTABLE)('MCP visible VS Code UI (.vscode/mcp.json)', () => {
  let server: HttpServerHarness;
  let workspaceDir: string;
  let userDataDir: string;
  let app: Awaited<ReturnType<(typeof import('playwright'))['_electron']['launch']>> | null = null;
  let window: Page | null = null;

  const dismissOnboarding = async (win: Page): Promise<void> => {
    const overlay = win.locator('.onboarding-a-overlay');
    for (let i = 0; i < 4; i++) {
      if ((await overlay.count()) === 0) return;
      const close = overlay.locator('button').first();
      if ((await close.count()) > 0) await close.click({ force: true }).catch(() => {});
      await sleep(1200);
    }
  };

  beforeAll(async () => {
    // The shipped .vscode/mcp.json names http://127.0.0.1:8765/mcp with no
    // bearer token, so the backing server must answer there without auth.
    server = await startHttpServer({ token: '', port: MCP_PORT, maxSessions: 8 });

    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-vscode-ws-'));
    fs.mkdirSync(path.join(workspaceDir, '.vscode'), { recursive: true });
    fs.copyFileSync(VSCODE_MCP_FIXTURE_PATH, path.join(workspaceDir, '.vscode', 'mcp.json'));

    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-vscode-udd-'));
    const settingsDir = path.join(userDataDir, 'User');
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.writeFileSync(
      path.join(settingsDir, 'settings.json'),
      JSON.stringify({
        'security.workspace.trust.enabled': false,
        'update.mode': 'none',
        'extensions.autoCheckUpdates': false,
        'telemetry.telemetryLevel': 'off',
        'workbench.startupEditor': 'none',
      }),
    );

    const { _electron } = await import('playwright');
    app = await _electron.launch({
      executablePath: VSCODE_EXECUTABLE!,
      args: ['--user-data-dir=' + userDataDir, '--disable-updates', '--no-sandbox', workspaceDir],
      cwd: getBuildPaths().root,
    });
    window = await app.firstWindow({ timeout: 90000 });
    await sleep(15000);
    await dismissOnboarding(window);
  }, 150000);

  afterAll(async () => {
    await app?.close().catch(() => {});
    await stopProcess(server.child);
    try {
      if (workspaceDir) fs.rmSync(workspaceDir, { recursive: true, force: true });
      if (userDataDir) fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  });

  it('shows the encodex server sourced from .vscode/mcp.json', async () => {
    await runMcpListServers(window!);
    const rows = await readQuickPickRows(window!);
    const encodex = rows.find((row) => /encodex/i.test(row.text) && row.text.includes('/.vscode/mcp.json'));
    expect(encodex).toBeTruthy();
    expect(encodex!.text).toContain('Stopped');
    expect(encodex!.aria).toContain('encodex');
    expect(encodex!.text).not.toMatch(/\[?error\]?/i);
  });

  it('flips the encodex server status to Running after Start Server', { timeout: 120000 }, async () => {
    await runMcpListServers(window!);
    await clickRow(window!, (row) => /encodex/i.test(row.text) && row.text.includes('/.vscode/mcp.json'), 'encodex row');
    await sleep(1500);
    await clickRow(window!, (row) => /start server/i.test(row.text), 'Start Server');
    await sleep(2000);

    await expect
      .poll(
        async () => {
          await window!.keyboard.press('Escape').catch(() => {});
          await sleep(600);
          try {
            await runMcpListServers(window!);
            const rows = await readQuickPickRows(window!);
            const encodex = rows.find((row) => /encodex/i.test(row.text) && row.text.includes('/.vscode/mcp.json'));
            return encodex?.text ?? '';
          } catch {
            return '';
          }
        },
        { timeout: 90000, interval: 4000 },
      )
      .toContain('Running');
  });
});
