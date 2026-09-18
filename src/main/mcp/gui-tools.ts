/**
 * @fileoverview GUI-parity MCP tools for the embedded (Phase 2) server.
 *
 * Registers tools that mirror capabilities the desktop GUI offers beyond the
 * core conversion surface: queue state/cancel-all, video preview frames,
 * timeline probing, system info, and update checks.
 *
 * The module is deliberately Electron-free: every external capability
 * (app version, preview extraction, update check, transcoder creation) is
 * injected via {@link GuiToolsDeps}, making each tool unit-testable with
 * fakes and letting index.ts supply the real implementations.
 */

import * as os from 'os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';
import { createError, ErrorCode } from '../../shared/errors';
import type { UpdateInfo } from '../../shared/types';
import type { MCPJobManager } from '../../mcp/jobs/manager';
import type { ITranscoder } from '../transcoders/types';
import type { TranscoderType } from '../../shared/types';
import { Logger } from '../../shared/logger';
import { LOG_MCP_GUI_TOOL_ERROR } from '../../shared/log-constants';
import { ok, fail } from '../../mcp/server';

/** Per-module logger for the GUI-parity tools. @const {Logger} */
const log = new Logger('main/mcp/gui-tools');

/**
 * Dependencies consumed by the GUI-parity tools.
 * @interface GuiToolsDeps
 * @property {MCPJobManager} jobManager - The shared queue manager (same
 *   instance backing the core conversion tools and the renderer's queue).
 * @property {string} appVersion - The running app version (from Electron's
 *   `app.getVersion()`), supplied by the caller so this module stays
 *   Electron-free.
 * @property {function(TranscoderType): ITranscoder} [transcoderFactory] -
 *   Creates transcoders for probing/timeline reads (defaults to the shared
 *   FFmpeg factory when omitted).
 * @property {function(string): Promise<string | null>} [getPreviewFrame] -
 *   Extracts a base64 PNG data URL preview frame (defaults to EncodeX's
 *   `getVideoPreview` when omitted).
 * @property {function(): Promise<UpdateInfo | null>} [checkForUpdate] -
 *   Queries the latest release (defaults to the updater when omitted).
 */
export interface GuiToolsDeps {
  jobManager: MCPJobManager;
  appVersion: string;
  transcoderFactory?: (type: TranscoderType) => ITranscoder;
  getPreviewFrame?: (input: string) => Promise<string | null>;
  checkForUpdate?: () => Promise<UpdateInfo | null>;
}

/**
 * Registers the six GUI-parity tools on the given server.
 *
 * @param {McpServer} server - The embedded MCP server (Phase 2 only).
 * @param {GuiToolsDeps} deps - Injected runtime capabilities.
 * @returns {void}
 */
export function registerGuiTools(server: McpServer, deps: GuiToolsDeps): void {
  const transcoderFactory = deps.transcoderFactory;
  const preview = deps.getPreviewFrame;
  const updateCheck = deps.checkForUpdate;

  server.registerTool(
    'get_queue_state',
    {
      title: 'Get Queue State',
      description: 'Returns every known conversion job with status/progress plus the count of pending (queued or running) jobs.',
      inputSchema: z.object({}),
    },
    async () =>
      ok(
        JSON.stringify({
          jobs: deps.jobManager.listJobs(),
          pending: deps.jobManager.pendingCount(),
        }),
      ),
  );

  server.registerTool(
    'cancel_all_jobs',
    {
      title: 'Cancel All Jobs',
      description: 'Cancels every queued and running conversion job and resets the queue (mirrors the GUI "cancel all").',
      inputSchema: z.object({}),
    },
    async () => {
      deps.jobManager.cancelAll();
      return ok(JSON.stringify({ cancelled: true }));
    },
  );

  if (transcoderFactory) {
    server.registerTool(
      'get_timeline',
      {
        title: 'Get Timeline',
        description: 'Probes a video and returns a timeline summary: container duration, frame rate, resolution, and format.',
        inputSchema: z.object({ input: z.string().min(1).describe('Absolute path of the video file to probe.') }),
      },
      async ({ input }: { input: string }) => {
        try {
          const info = await transcoderFactory('FFMPEG').getInfo(input);
          const video = info.streams.find((s) => s.type === 'video');
          return ok(
            JSON.stringify({
              file: info.file,
              format: info.format,
              duration: info.duration,
              fps: video?.avgFrameRate ?? video?.frameRate ?? null,
              width: video?.width ?? null,
              height: video?.height ?? null,
              codec: video?.codec ?? null,
            }),
          );
        } catch (err) {
          log.warn(LOG_MCP_GUI_TOOL_ERROR, 'get_timeline:', err);
          return fail(createError(ErrorCode.UNKNOWN, `Failed to probe timeline: ${err instanceof Error ? err.message : String(err)}`));
        }
      },
    );
  }

  if (preview) {
    server.registerTool(
      'extract_preview',
      {
        title: 'Extract Preview',
        description:
          'Extracts a single PNG preview frame from a video and returns it as a base64 data URL (mirrors the GUI player thumbnail).',
        inputSchema: z.object({ input: z.string().min(1).describe('Absolute path of the video file to preview.') }),
      },
      async ({ input }: { input: string }) => {
        try {
          const dataUrl = await preview(input);
          if (!dataUrl) {
            return fail(createError(ErrorCode.UNKNOWN, `Could not extract a preview frame from: ${input}`));
          }
          return ok(JSON.stringify({ dataUrl }));
        } catch (err) {
          log.warn(LOG_MCP_GUI_TOOL_ERROR, 'extract_preview:', err);
          return fail(err);
        }
      },
    );
  }

  server.registerTool(
    'get_system_info',
    {
      title: 'Get System Info',
      description: 'Returns OS/hardware information plus the running EncodeX version.',
      inputSchema: z.object({}),
    },
    async () =>
      ok(
        JSON.stringify({
          appVersion: deps.appVersion,
          platform: process.platform,
          arch: process.arch,
          os: {
            type: os.type(),
            release: os.release(),
            cpu: os.cpus()[0]?.model ?? 'unknown',
            cpuCount: os.cpus().length,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
          },
        }),
      ),
  );

  if (updateCheck) {
    server.registerTool(
      'check_for_updates',
      {
        title: 'Check For Updates',
        description:
          'Checks the releases feed for a newer EncodeX version matching this platform and reports the latest release when one exists.',
        inputSchema: z.object({}),
      },
      async () => {
        try {
          const update = await updateCheck();
          if (!update) {
            return ok(JSON.stringify({ available: false, current: deps.appVersion }));
          }
          return ok(
            JSON.stringify({
              available: true,
              current: deps.appVersion,
              latest: update.version,
              releaseUrl: update.releaseUrl,
            }),
          );
        } catch (err) {
          log.warn(LOG_MCP_GUI_TOOL_ERROR, 'check_for_updates:', err);
          return fail(err);
        }
      },
    );
  }
}
