/**
 * @fileoverview Streamable-HTTP MCP server for EncodeX (closes the Phase 6.2
 * "MCP HTTP transport" row of `plans/ADVERSARIAL_TEST_HARDENING_PLAN.md`).
 *
 * This module hoists the shared {@link createMcpServer} tool surface onto the
 * MCP Streamable HTTP transport so agents can also reach the media engine over
 * HTTP instead of only stdio. One `SDK StreamableHTTPServerTransport` maps to
 * exactly one MCP session (the SDK's `Protocol.connect` rejects reconnects),
 * so every session is an independent McpServer instance that shares a single
 * {@link MCPJobManager} and transcoder factory -- job state is shared across
 * sessions while each session keeps its own protocol lifecycle.
 *
 * The HTTP surface is hostile-input hardened on purpose:
 *
 *  - **Loopback-only.** `runMcpHttpServer` refuses to bind any non-loopback
 *    host, and every request's `Host`/`Origin` header must resolve to a
 *    loopback hostname (403 otherwise). Nothing is ever exposed beyond the
 *    local machine, and DNS-rebinding attempts are rejected per request.
 *  - **Optional bearer auth.** When a `bearerToken` is configured, every
 *    request must present `Authorization: Bearer <token>` compared in
 *    constant time; a token passed through the query string is rejected.
 *  - **Bounded sessions.** New sessions are refused (503) once `maxSessions`
 *    is reached so a hostile client cannot grow the session table without
 *    bound; DELETE closes and removes a session.
 *  - **Bounded bodies.** POST bodies over `maxBodyBytes` are refused (413),
 *    including chunked bodies that avoid a Content-Length header.
 *  - **Deterministic protocol errors.** Wrong paths get 404, unsupported
 *    methods 405, non-JSON POST bodies 415, unparseable JSON 400.
 *
 * The module has no process-level side effects (it never calls `listen` on its
 * own), so it is safe to import from the Electron main process and from tests.
 */

import { randomUUID, timingSafeEqual } from 'crypto';
import * as http from 'http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Logger } from '../shared/logger';
import { APP_NAME } from '../shared/app-constants';
import { createMcpServer } from './server';
import { MCPJobManager } from './jobs/manager';
import { createTranscoder } from '../main/transcoders/factory';
import type { ITranscoder } from '../main/transcoders/types';
import type { TranscoderType } from '../shared/types';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const log = new Logger('mcp/http');

/** Default request path the MCP listener is mounted at. */
export const MCP_HTTP_DEFAULT_PATH = '/mcp';

/** Default host when none is provided; the server refuses anything else. */
export const MCP_HTTP_DEFAULT_HOST = '127.0.0.1';

/**
 * Default cap on a single request body. Mirrors the 10 MB cap of the SDK's
 * stdio `ReadBuffer` so both transports refuse oversized payloads the same way.
 */
export const MCP_HTTP_DEFAULT_MAX_BODY_BYTES = 10 * 1024 * 1024;

/**
 * Default cap on simultaneously open sessions. Each session pins an McpServer
 * plus an SSE state machine, so the table must be bounded even when hostile
 * clients never DELETE.
 */
export const MCP_HTTP_DEFAULT_MAX_SESSIONS = 64;

/** Hostnames that resolve to the local machine. '0.0.0.0' is deliberately absent. */
export const MCP_HTTP_LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set(['127.0.0.1', '::1', 'localhost']);

/** Query-string parameter names that are refused because a token must never ride there. */
const FORBIDDEN_QUERY_PARAMS = ['access_token', 'token', 'auth', 'authorization'] as const;

/**
 * Configuration for the MCP HTTP listener.
 * @interface McpHttpServerOptions
 * @property {string} [name] - Server name advertised in the MCP handshake.
 * @property {string} [version] - Server version advertised in the handshake.
 * @property {function(TranscoderType): ITranscoder} [transcoderFactory] - Test seam; defaults to the shared factory.
 * @property {MCPJobManager} [jobManager] - Shared job manager used by every session (test seam).
 * @property {string} [basePath] - URL path the listener is mounted at (default {@link MCP_HTTP_DEFAULT_PATH}).
 * @property {string} [host] - Bind host; anything outside {@link MCP_HTTP_LOOPBACK_HOSTNAMES} is refused.
 * @property {number} [port] - Port for `runMcpHttpServer`; 0 picks an ephemeral port.
 * @property {string} [bearerToken] - When set, every request must authenticate with it.
 * @property {number} [maxBodyBytes] - Request body cap (default 10 MB).
 * @property {number} [maxSessions] - Session table cap (default 64).
 */
export interface McpHttpServerOptions {
  name?: string;
  version?: string;
  transcoderFactory?: (type: TranscoderType) => ITranscoder;
  jobManager?: MCPJobManager;
  basePath?: string;
  host?: string;
  port?: number;
  bearerToken?: string;
  maxBodyBytes?: number;
  maxSessions?: number;
}

/** One open MCP session: its transport plus the McpServer bound to it. */
interface SessionRecord {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
}

/** Refuses any host that could expose the server beyond the local machine. */
export function assertLoopbackBind(host: string): void {
  if (!MCP_HTTP_LOOPBACK_HOSTNAMES.has(host.replace(/^\[|\]$/g, '').toLowerCase())) {
    throw new Error(`Refusing to bind MCP HTTP server to non-loopback host "${host}".`);
  }
}

/** Constant-time comparison that hashes the same number of bytes regardless of the lengths. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  const max = Math.max(ab.length, bb.length);
  const ap = Buffer.alloc(max);
  const bp = Buffer.alloc(max);
  ab.copy(ap);
  bb.copy(bp);
  timingSafeEqual(ap, bp);
  return ab.length === bb.length;
}

/** Extracts a `Bearer <token>` token, or null when the scheme is missing/wrong. */
function extractBearer(auth: string | undefined): string | null {
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return match ? match[1] : null;
}

/** The hostname part of a Host or Origin header value, lower-cased and bracket-stripped. */
function headerHostname(value: string): string | null {
  try {
    const url = value.includes('://') ? new URL(value) : new URL(`http://${value}`);
    return url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  } catch {
    return null;
  }
}

function isLoopbackHeader(value: string | undefined): boolean {
  if (!value) return true;
  const hostname = headerHostname(value);
  return hostname !== null && MCP_HTTP_LOOPBACK_HOSTNAMES.has(hostname);
}

/** Sends a short JSON error body with the given status and our own headers. */
function respondJson(res: http.ServerResponse, status: number, body: Record<string, unknown>, extraHeaders?: Record<string, string>): void {
  if (res.headersSent) {
    res.end();
    return;
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extraHeaders };
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

/**
 * Reads a POST body up to `maxBytes` bytes, resolving `null` when a hostile
 * client exceeds the cap (the request is destroyed after a 413 is sent).
 * Rejects with `false` when the connection errors before the body completes.
 */
function readBody(req: http.IncomingMessage, maxBytes: number): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let overflow = false;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        overflow = true;
        req.pause();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!overflow) resolve(Buffer.concat(chunks));
    });
    req.on('error', () => reject(new Error('request body read failed')));
  });
}

/**
 * Creates the request-handler function that drives the MCP Streamable HTTP
 * surface. Callers mount it on an `http.Server` (see {@link createMcpHttpServer}).
 * @param {McpHttpServerOptions} [options] - Server configuration.
 * @returns {http.RequestListener} The listener for incoming requests.
 */
export function createMcpHttpHandler(options: McpHttpServerOptions = {}): http.RequestListener {
  const basePath = options.basePath ?? MCP_HTTP_DEFAULT_PATH;
  const maxBodyBytes = options.maxBodyBytes ?? MCP_HTTP_DEFAULT_MAX_BODY_BYTES;
  const maxSessions = options.maxSessions ?? MCP_HTTP_DEFAULT_MAX_SESSIONS;
  const bearerToken = options.bearerToken;
  const transcoderFactory = options.transcoderFactory ?? createTranscoder;
  const jobManager = options.jobManager ?? new MCPJobManager({ transcoderFactory });
  const sessions = new Map<string, SessionRecord>();
  // Sessions being created right now. A request passes the cap only while
  // `sessions.size + reserving` is under maxSessions, and `reserving` is
  // incremented synchronously after the check, so a burst of parallel
  // initializes can never overshoot the cap the way a bare map-sized check
  // would.
  let reserving = 0;

  const handler = async (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> => {
    try {
      // 1. Authentication and topology guards run before any transport code so a
      // hostile peer can never reach session handling without passing them.
      if (bearerToken) {
        const supplied = extractBearer(req.headers.authorization);
        if (!supplied || !safeEqual(supplied, bearerToken)) {
          respondJson(res, 401, { error: 'Unauthorized' }, { 'WWW-Authenticate': 'Bearer' });
          return;
        }
      }

      const url = new URL(req.url ?? '/', 'http://internal');
      for (const param of FORBIDDEN_QUERY_PARAMS) {
        if (url.searchParams.has(param)) {
          respondJson(res, 400, { error: 'Authentication via the query string is not allowed.' });
          return;
        }
      }

      // Host/Origin must resolve to a loopback hostname; this refuses DNS
      // rebinding and cross-origin browser pipes on the local server.
      if (!isLoopbackHeader(req.headers.host) || !isLoopbackHeader(req.headers.origin)) {
        respondJson(res, 403, { error: 'This server only accepts loopback requests.' });
        return;
      }

      if (url.pathname !== basePath && url.pathname !== `${basePath}/`) {
        respondJson(res, 404, { error: 'Not found.' });
        return;
      }

      const sessionHeader = typeof req.headers['mcp-session-id'] === 'string' ? req.headers['mcp-session-id'] : undefined;

      if (req.method === 'DELETE') {
        const record = sessionHeader ? sessions.get(sessionHeader) : undefined;
        if (!record) {
          respondJson(res, 404, { error: 'Session not found.' });
          return;
        }
        await record.transport.close();
        sessions.delete(sessionHeader!);
        respondJson(res, 200, { ok: true });
        return;
      }

      if (req.method === 'GET') {
        if (!sessionHeader) {
          respondJson(res, 400, { error: 'A GET request requires an mcp-session-id header.' });
          return;
        }
        const record = sessions.get(sessionHeader);
        if (!record) {
          respondJson(res, 404, { error: 'Session not found.' });
          return;
        }
        await record.transport.handleRequest(req, res);
        return;
      }

      if (req.method !== 'POST') {
        respondJson(res, 405, { error: 'Method not allowed.' }, { Allow: 'GET, POST, DELETE' });
        return;
      }

      // POST (both new sessions and existing-session traffic).
      const contentType = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
      if (contentType !== 'application/json') {
        respondJson(res, 415, { error: 'Content-Type must be application/json.' });
        return;
      }

      const declaredLength = Number(req.headers['content-length']);
      if (Number.isFinite(declaredLength) && declaredLength > maxBodyBytes) {
        respondJson(res, 413, { error: 'Request body too large.' });
        return;
      }

      let body: Buffer;
      try {
        const read = await readBody(req, maxBodyBytes);
        if (read === null) {
          respondJson(res, 413, { error: 'Request body too large.' });
          // The client is still sending: finish the 413 response, then drop the
          // socket so an endless upload cannot pin the connection forever.
          res.once('finish', () => req.destroy());
          return;
        }
        body = read;
      } catch {
        respondJson(res, 400, { error: 'Failed to read the request body.' });
        return;
      }

      let payload: unknown;
      try {
        payload = JSON.parse(body.toString('utf8'));
      } catch {
        respondJson(res, 400, { error: 'Parse error: invalid JSON.' });
        return;
      }

      const record = sessionHeader ? sessions.get(sessionHeader) : undefined;

      // A session header naming a session we do not know is refused before we
      // allocate anything for the attacker.
      if (sessionHeader && !record) {
        respondJson(res, 404, { error: 'Session not found.' });
        return;
      }

      if (record) {
        await record.transport.handleRequest(req, res, payload);
        return;
      }

      // Brand-new session: initialize is implied by the transport; refuse once
      // the table (plus in-flight creations) is full so a hostile client cannot
      // grow it unboundedly, even with a concurrent burst.
      if (sessions.size + reserving >= maxSessions) {
        respondJson(res, 503, { error: 'Too many open sessions.' });
        return;
      }
      reserving += 1;
      try {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
        });
        transport.onclose = () => {
          if (transport.sessionId) sessions.delete(transport.sessionId);
        };
        const server = createMcpServer({ name: options.name ?? APP_NAME, version: options.version, transcoderFactory, jobManager });
        await server.connect(transport);
        await transport.handleRequest(req, res, payload);
        // The transport assigns the session id during the initialize request; if
        // it never does (e.g. the first message was not an initialize), close the
        // orphan instead of letting it leak.
        if (transport.sessionId) {
          sessions.set(transport.sessionId, { transport, server });
        } else {
          await transport.close();
        }
      } finally {
        reserving -= 1;
      }
    } catch (err: unknown) {
      log.error('MCP HTTP request failed', err);
      respondJson(res, 500, { error: 'Internal server error.' });
    }
  };

  return handler;
}

/**
 * Creates an `http.Server` with the {@link createMcpHttpHandler} mounted and a
 * `clientError` guard so malformed HTTP never crashes the process or closes the
 * listener.
 * @param {McpHttpServerOptions} [options] - Server configuration.
 * @returns {http.Server} A not-yet-listening server.
 */
export function createMcpHttpServer(options: McpHttpServerOptions = {}): http.Server {
  const server = http.createServer(createMcpHttpHandler(options));
  server.on('clientError', (err, socket) => {
    log.warn('MCP HTTP client error', err instanceof Error ? err.message : err);
    if (socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    }
  });
  return server;
}

/**
 * Binds {@link createMcpHttpServer} and resolves when the server closes.
 * Refuses automatically anything but a loopback bind host.
 * @param {McpHttpServerOptions} [options] - Server configuration.
 * @returns {Promise<void>} Resolves when the server stops listening.
 * @throws {Error} `EADDRINUSE`-style listen errors and non-loopback hosts.
 */
export async function runMcpHttpServer(options: McpHttpServerOptions = {}): Promise<void> {
  const host = options.host ?? MCP_HTTP_DEFAULT_HOST;
  assertLoopbackBind(host);
  const basePath = options.basePath ?? MCP_HTTP_DEFAULT_PATH;
  const server = createMcpHttpServer(options);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, host, () => resolve());
  });
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : Number(options.port ?? 0);
  // Machine-readable readiness marker. Printed with plain console.log so it is
  // immune to LOG_LEVEL: spawn harnesses (http-hostile.integration.test.ts)
  // and process supervisors parse this line to learn the actual port.
  console.log(
    `MCP_HTTP_READY http://${host}:${port}${basePath} host=${host} auth=${options.bearerToken ? 'on' : 'off'} sessions=0/${
      options.maxSessions ?? MCP_HTTP_DEFAULT_MAX_SESSIONS
    }`,
  );
  await new Promise<void>((resolve) => {
    server.once('close', () => resolve());
  });
}
