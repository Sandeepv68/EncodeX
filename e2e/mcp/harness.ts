/**
 * @fileoverview W1 shared harness for the MCP e2e suite.
 *
 * Owns process lifecycle (spawn/parse/stop the stdio and standalone-HTTP
 * servers), the polling helpers that wait for them, the throwaway userData
 * seeding that gets the embedded GUI to honour a given `mcp-settings.json`,
 * and the per-spec media fixtures, so the specs themselves only describe
 * behaviour. Every element here is reused by the stdio, standalone-HTTP,
 * embedded-GUI, and VS Code-contract specs.
 *
 * Process teardown mirrors `e2e/cli.spec.ts` + `scripts/mcp-full-test.mjs`:
 * `taskkill /T` on win32, SIGTERM→SIGKILL elsewhere, and `closeApp` for the
 * Electron GUI. Nothing here touches a real profile: the embedded harness
 * always launches with an injected `--user-data-dir`, and we verified locally
 * that Electron's `app.getPath('userData')` honours that switch.
 */

import { spawn, spawnSync } from 'child_process';
import type { ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
import * as path from 'path';
import type { ElectronApplication } from 'playwright';
import {
  ensureBuildExists,
  getBuildPaths,
  getFfmpegPath,
  generateTestMedia,
  generateTestDemuxSource,
  generateTestImage,
  generateTestAudio,
  generateTestSubtitle,
  generateTestChapters,
} from '../helpers';
import { CHROMIUM_STABILITY_ARGS, buildEnv, closeApp, createUserDataDir } from '../fixtures/app';
import { attachTripwire } from '../fixtures/tripwire';
import type { McpSettings } from '../../src/shared/mcp-settings';

/**
 * File name of the embedded-server settings document inside userData. Kept
 * local (rather than importing `src/main/mcp/settings.ts`, which wires a main-
 * process Logger at import time) and pinned to the main-process constant; a
 * rename must be mirrored here.
 * @const {string}
 */
const MCP_SETTINGS_FILENAME = 'mcp-settings.json';

/**
 * Canonical VS Code MCP client config. `.vscode/` is gitignored (editor-local),
 * so the shipped contract is tracked here instead and both the W6 and W9 specs
 * read/copy it verbatim rather than the repo's own `.vscode/mcp.json`.
 * @const {string}
 */
export const VSCODE_MCP_FIXTURE_PATH = path.join(__dirname, 'fixtures', 'vscode-mcp.json');

/** The 16 tools registered by the core MCP server (`src/mcp/server.ts`); `commit_operation` is app-only. @const {string[]} */
export const CORE_TOOLS = [
  'ping',
  'convert_media',
  'get_job',
  'list_jobs',
  'cancel_job',
  'get_media_info',
  'list_capabilities',
  'list_profiles',
  'get_profile',
  'compress_image',
  'extract_audio',
  'cut_video',
  'batch_convert',
  'remux_media',
  'demux_media',
  'commit_operation',
];

/** The 6 GUI-parity tools registered only on the embedded server. @const {string[]} */
export const GUI_TOOLS = ['get_queue_state', 'cancel_all_jobs', 'get_timeline', 'extract_preview', 'get_system_info', 'check_for_updates'];

/** Every tool the embedded (GUI) server advertises. @const {string[]} */
export const ALL_TOOLS = [...CORE_TOOLS, ...GUI_TOOLS];

/** Resource URIs served by every surface (JSON data + MCP App views). @const {string[]} */
export const RESOURCE_URIS = [
  'encodex://profiles',
  'encodex://capabilities',
  'encodex://codecs',
  'ui://encodex/queue',
  'ui://encodex/job',
  'ui://encodex/media-info',
  'ui://encodex/convert',
];

/** Prompt names rendered by every surface. @const {string[]} */
export const PROMPT_NAMES = ['convert-video', 'extract-audio', 'compress-image', 'batch-convert'];

/** @param {number} ms - Milliseconds to sleep. @returns {Promise<void>} */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls `fn` until it resolves, re-raising the last error on timeout.
 * @template T
 * @param {() => Promise<T>} fn - The condition to satisfy.
 * @param {{ timeout?: number; interval?: number }} [opts] - Bounds.
 * @returns {Promise<T>} The value `fn` resolved with.
 */
export async function waitFor<T>(fn: () => Promise<T>, opts: { timeout?: number; interval?: number } = {}): Promise<T> {
  const { timeout = 30000, interval = 200 } = opts;
  const deadline = Date.now() + timeout;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await sleep(interval);
    }
  }
  throw new Error(
    `timed out after ${timeout}ms: ${lastError instanceof Error ? lastError.message : String(lastError ?? 'condition not met')}`,
  );
}

/**
 * Reserves a free TCP port on the loopback interface by binding an ephemeral
 * socket and closing it. Embedded settings must name a concrete 1024-65535
 * port (the app binds it at boot), so this is how the specs pick one without
 * colliding with the standalone servers, which use `--port 0`.
 * @returns {Promise<number>} A currently-free loopback port.
 */
export function pickFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      server.close(() => (port === 0 ? reject(new Error('pickFreePort returned zero')) : resolve(port)));
    });
  });
}

/**
 * Terminates a spawned process, killing the whole tree on Windows so orphaned
 * child processes cannot pin files or sockets after the test.
 * @param {ChildProcess | null} child - The spawned process (may be null).
 * @returns {Promise<void>}
 */
export async function stopProcess(child: ChildProcess | null): Promise<void> {
  if (!child || child.exitCode !== null || child.pid === undefined) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  child.kill('SIGTERM');
  const deadline = Date.now() + 5000;
  while (child.exitCode === null && Date.now() < deadline) await sleep(100);
  if (child.exitCode === null) child.kill('SIGKILL');
}

/** @interface RawHttpResponse */
export interface RawHttpResponse {
  status: number;
  text: string;
  headers: http.IncomingHttpHeaders;
}

/**
 * Issues a raw HTTP request against a loopback server so the security probes
 * can control headers (authorization, origin, host, content-type) and methods
 * that the MCP SDK client can never send.
 * @param {number} port - Port on 127.0.0.1.
 * @param {{ method?: string; urlPath?: string; headers?: Record<string, string>; body?: string }} [spec] - Request shape.
 * @returns {Promise<RawHttpResponse>} Resolved status, body text, and headers.
 */
export function rawHttp(
  port: number,
  spec: { method?: string; urlPath?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<RawHttpResponse> {
  const { method = 'POST', urlPath = '/mcp', headers = {}, body } = spec;
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method, path: urlPath, headers: { Connection: 'close', ...headers }, agent: false },
      (res) => {
        const chunks: Buffer[] = [];
        const finish = () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8'), headers: res.headers });
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', finish);
        res.on('error', finish);
      },
    );
    req.setTimeout(7000, () => req.destroy(new Error('rawHttp timeout')));
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

/**
 * Polls an MCP endpoint until it answers *any* HTTP response.
 *
 * The embedded server logs its readiness through the app logger rather than a
 * machine-readable stdout line, so an HTTP round-trip is the only reliable
 * liveness signal. A GET without an `mcp-session-id` returns a 4xx on both
 * server implementations - still a response, which is all "reachable" means
 * here.
 * @param {string} url - The `/mcp` endpoint URL.
 * @param {number} [timeout] - Overall bound in ms.
 * @returns {Promise<void>}
 */
export async function waitForHttp(url: string, timeout = 60000): Promise<void> {
  const deadline = Date.now() + timeout;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await fetch(url, { method: 'GET', signal: AbortSignal.timeout(3000) });
      return;
    } catch (error) {
      lastError = error;
      await sleep(500);
    }
  }
  throw new Error(`endpoint ${url} never came up: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

/** Stdio server target used by {@link Client.connectStdio}. @returns {{command: string; args: string[]}} */
export function nodeStdioTarget(): { command: string; args: string[] } {
  return { command: process.execPath, args: [path.join(getBuildPaths().root, 'dist', 'mcp', 'index.js')] };
}

/** @interface HttpServerHarness */
export interface HttpServerHarness {
  child: ChildProcess;
  port: number;
  /** The token the server actually printed on startup. */
  printedToken: string;
  stderr: string;
}

/**
 * Spawns the standalone Streamable-HTTP MCP server and waits for it to print
 * its readiness marker. `--port 0` picks an ephemeral port; the machine-
 * readable `MCP_HTTP_READY http://127.0.0.1:<port>/mcp` line is parsed exactly
 * like `scripts/mcp-full-test.mjs` parses it.
 * @param {{ token?: string; port?: number; maxSessions?: number }} [opts] - Spawn options.
 * @returns {Promise<HttpServerHarness>} The child plus the resolved port/token.
 */
export async function startHttpServer(opts: { token?: string; port?: number; maxSessions?: number } = {}): Promise<HttpServerHarness> {
  ensureBuildExists();
  const { token = `encodex-e2e-${Math.random().toString(36).slice(2, 10)}`, port, maxSessions = 16 } = opts;
  const args = ['--token', token, '--max-sessions', String(maxSessions)];
  if (port !== undefined) args.push('--port', String(port));
  const child = spawn(process.execPath, [path.join(getBuildPaths().root, 'dist', 'mcp', 'http-server.js'), ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let buffer = '';
  let printedToken = '';
  let stderr = '';
  let readyPort: number | null = null;

  child.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
    let index = buffer.indexOf('\n');
    while (index !== -1) {
      const line = buffer.slice(0, index).replace(/\r$/, '');
      buffer = buffer.slice(index + 1);
      const tokenMatch = /^MCP_HTTP_TOKEN=(.+)$/.exec(line);
      if (tokenMatch) printedToken = tokenMatch[1];
      const readyMatch = /MCP_HTTP_READY http:\/\/127\.0\.0\.1:(\d+)/.exec(line);
      if (readyMatch) readyPort = Number(readyMatch[1]);
      index = buffer.indexOf('\n');
    }
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8');
    if (stderr.length > 8192) stderr = stderr.slice(-8192);
  });
  child.stdout?.on('error', () => {});
  child.stderr?.on('error', () => {});

  try {
    await waitFor(
      async () => {
        if (readyPort === null) throw new Error(`server never printed MCP_HTTP_READY. stderr: ${stderr.slice(-800)}`);
        if (child.exitCode !== null) throw new Error(`server exited early (code ${child.exitCode}). stderr: ${stderr.slice(-800)}`);
      },
      { timeout: 15000, interval: 50 },
    );
  } catch (error) {
    await stopProcess(child);
    throw error;
  }
  return { child, port: readyPort!, printedToken: printedToken || token, stderr };
}

/**
 * Writes `mcp-settings.json` into a throwaway userData directory so the GUI
 * boots its embedded server exactly like a user who enabled it in Settings.
 * @param {string} userDataDir - Directory created by {@link createUserDataDir}.
 * @param {McpSettings} settings - The settings to persist.
 * @returns {string} The absolute path written.
 */
export function seedMcpSettings(userDataDir: string, settings: McpSettings): string {
  const filePath = path.join(userDataDir, MCP_SETTINGS_FILENAME);
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8');
  return filePath;
}

/** @interface EmbeddedServerSession */
export interface EmbeddedServerSession {
  app: ElectronApplication;
  userDataDir: string;
  url: string;
  port: number;
  token: string;
}

/**
 * Launches the built Electron GUI with the embedded MCP server enabled and
 * waits until its `/mcp` endpoint answers.
 *
 * The launch reuses the existing `CHROMIUM_STABILITY_ARGS` and an injected
 * `--user-data-dir` (which, verified locally, redirects
 * `app.getPath('userData')`, so the seeded settings are picked up without ever
 * touching a real profile). The crash tripwire is attached the same way
 * `launchApp` attaches it, so GUI boot faults fail the spec.
 * @param {McpSettings} settings - Settings to seed; `enabled` must be true.
 * @param {{ mock?: boolean }} [opts] - Whether to load the mock preload.
 * @returns {Promise<EmbeddedServerSession>}
 */
export async function launchEmbeddedApp(settings: McpSettings, opts: { mock?: boolean } = {}): Promise<EmbeddedServerSession> {
  const { mock = false } = opts;
  ensureBuildExists();
  const userDataDir = createUserDataDir();
  seedMcpSettings(userDataDir, settings);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { _electron } = await import('playwright');
  const paths = getBuildPaths();
  const app = await _electron.launch({
    args: [paths.mainEntry, `--user-data-dir=${userDataDir}`, ...CHROMIUM_STABILITY_ARGS],
    cwd: paths.root,
    env: buildEnv(mock, {}),
  });
  attachTripwire(app);

  const url = `http://127.0.0.1:${settings.port}/mcp`;
  try {
    await waitForHttp(url, 90000);
  } catch (error) {
    await closeApp(app, userDataDir);
    throw error;
  }
  return { app, userDataDir, url, port: settings.port, token: settings.token };
}

/** @param {EmbeddedServerSession} session - Session to tear down. @returns {Promise<void>} */
export async function closeEmbeddedApp(session: EmbeddedServerSession): Promise<void> {
  await closeApp(session.app, session.userDataDir);
}

/** @interface MediaFixtures */
export interface MediaFixtures {
  dir: string;
  video: string;
  video2: string;
  long: string;
  image: string;
  audio: string;
  subtitle: string;
  chapters: string;
  demuxSource: string;
  outStdio: string;
  outHttp: string;
  outGui: string;
}

/**
 * Generates the full set of tiny real media fixtures for one spec file plus
 * the output directories the conversions write into. Reuses the repo's ffmpeg
 * generators from `e2e/helpers.ts`; all clips are ≤2s except `long`, which only
 * the cancel-flow tests need.
 * @param {string} tmpDir - Scratch directory for this spec.
 * @returns {MediaFixtures} Absolute fixture paths.
 */
export function createMediaFixtures(tmpDir: string): MediaFixtures {
  fs.mkdirSync(tmpDir, { recursive: true });
  const video = generateTestMedia(tmpDir, 'a.mp4');
  const video2 = generateTestMedia(tmpDir, 'b.mp4');
  const long = generateLongClip(path.join(tmpDir, 'long.mp4'));
  const image = generateTestImage(tmpDir, 'pic.png');
  const audio = generateTestAudio(tmpDir, 'extra-audio.m4a');
  const subtitle = generateTestSubtitle(tmpDir, 'forced.srt');
  const chapters = generateTestChapters(tmpDir, 'meta.txt');
  const demuxSource = generateTestDemuxSource(tmpDir);
  const outStdio = path.join(tmpDir, 'out-stdio');
  const outHttp = path.join(tmpDir, 'out-http');
  const outGui = path.join(tmpDir, 'out-gui');
  for (const dir of [outStdio, outHttp, outGui]) fs.mkdirSync(dir, { recursive: true });
  return { dir: tmpDir, video, video2, long, image, audio, subtitle, chapters, demuxSource, outStdio, outHttp, outGui };
}

/**
 * Generates the ~30s 640x360 clip used only by cancel-flow tests. Encoding it
 * is the slowest fixture, so it is generated exactly once per spec in
 * `beforeAll` and reused by every cancellation assertion.
 * @param {string} outputPath - Destination file.
 * @returns {string} The generated file path.
 */
export function generateLongClip(outputPath: string): string {
  if (fs.existsSync(outputPath)) return outputPath;
  const ffmpeg = getFfmpegPath();
  const result = spawnSync(
    ffmpeg,
    [
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=30:size=640x360:rate=25',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-an',
      outputPath,
    ],
    { timeout: 120000 },
  );
  if (result.status !== 0) {
    throw new Error(`Failed to generate long clip: ${result.stderr.toString()}`);
  }
  return outputPath;
}
