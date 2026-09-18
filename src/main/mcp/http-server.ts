/**
 * @fileoverview Embedded MCP server over Streamable HTTP, bound to loopback.
 *
 * Serves an existing {@link McpServer} instance over Node's `http` server on
 * 127.0.0.1 so the running Electron app can be driven by MCP clients while
 * staying reachable only from the local machine.
 *
 * Security model (loopback-only):
 *  - Binds 127.0.0.1 exclusively; the OS blocks remote hosts.
 *  - "DNS rebinding" guard: when the request carries an `Origin` header (a
 *    browser/SSE client), it must be `http://127.0.0.1:<port>` or
 *    `http://localhost:<port>`; otherwise 403. Non-browser MCP clients (the
 *    SDK's Streamable HTTP client) do not send `Origin`, so they are allowed.
 *  - Optional bearer token: when `token` is configured every request must send
 *    `Authorization: Bearer <token>` (401 otherwise). This keeps a local
 *    malicious web page (via DNS rebinding / CORS) from driving conversions.
 *  - Stateful sessions: each initialize creates a session via a random UUID;
 *    follow-up requests carry `Mcp-Session-Id`. DELETE closes a session; all
 *    sessions are torn down on server close.
 */

import * as http from 'http';
import type { Server } from 'http';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '../../shared/logger';
import { LOG_MCP_HTTP_STARTED, LOG_MCP_HTTP_START_FAILED, LOG_MCP_HTTP_STOPPED, LOG_MCP_HTTP_REJECTED } from '../../shared/log-constants';
import type { McpSettings } from './settings';

/** Per-module logger for the embedded MCP HTTP server. @const {Logger} */
const log = new Logger('main/mcp/http-server');

/** Single MCP route mounted at this path. @const {string} */
export const MCP_HTTP_PATH = '/mcp';

/** Map from live session id to its transport + session server. @type {Map<string, { transport: StreamableHTTPServerTransport; server: McpServer }>} */
const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: McpServer }>();

/**
 * Factory that builds a fresh {@link McpServer} per HTTP session. Each MCP
 * session owns its Protocol instance (the SDK forbids sharing one across
 * transports), so the gateway calls this once per new session. The factory
 * must wire every session to the same shared engine (job manager, transcoders).
 * @callback McpSessionServerFactory
 * @returns {McpServer | Promise<McpServer>} A configured, unconnected MCP server.
 */
export type McpSessionServerFactory = () => McpServer | Promise<McpServer>;

/**
 * Handle returned by {@link startMcpHttpServer} for stopping the server and
 * reading its live bound port.
 * @interface McpHttpHandle
 * @property {function(): Promise<void>} close - Stops all MCP sessions and the
 *   HTTP listener.
 * @property {function(): number} port - Returns the actual bound port (useful
 *   when an ephemeral port was requested).
 */
export interface McpHttpHandle {
  close(): Promise<void>;
  port(): number;
}

/**
 * Normalizes a request path to the canonical MCP route, tolerating a trailing
 * slash so `/mcp/` behaves like `/mcp`.
 * @param {string | undefined} rawUrl - `req.url` value.
 * @returns {string | null} Canonical route if this is the MCP endpoint, else null.
 */
function normalizeMcpPath(rawUrl: string | undefined): string | null {
  const pathOnly = rawUrl ? rawUrl.split('?')[0] : '';
  if (pathOnly === MCP_HTTP_PATH || pathOnly === `${MCP_HTTP_PATH}/`) return MCP_HTTP_PATH;
  return null;
}

/**
 * Validates the `Origin` header against the loopback origins matching this
 * server's bound port. Requests without an `Origin` header (curl, the SDK
 * client transport, most tools) are permitted.
 * @param {http.IncomingMessage} req - Incoming request.
 * @param {number} port - Port this server is bound to.
 * @returns {boolean} True when the origin (if present) is permitted.
 */
function originIsAllowed(req: http.IncomingMessage, port: number): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  const allowed = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
  return allowed.has(origin);
}

/**
 * Checks the optional bearer token on a request. When no token is configured
 * every local request is allowed; when one is, the `Authorization` header must
 * carry exactly `Bearer <token>` (timing-safe comparison).
 * @param {http.IncomingMessage} req - Incoming request.
 * @param {string} token - Configured token (empty string disables auth).
 * @returns {boolean} True when the request is authorized.
 */
function isAuthorized(req: http.IncomingMessage, token: string): boolean {
  if (!token) return true;
  const header = req.headers.authorization ?? '';
  if (header.length !== token.length + 7) return false; // "Bearer " prefix
  const expected = `Bearer ${token}`;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Builds the request handler shared per lifetime of one MCP server settings
 * snapshot. Captures `settings.token` and the resolved port for rejection
 * decisions.
 * @param {McpSessionServerFactory} serverFactory - Creates a fresh MCP server
 *   per HTTP session.
 * @param {McpSettings} settings - Settings at the time the handler was built.
 * @param {() => number} getPort - Returns the currently bound port.
 * @returns {(req: http.IncomingMessage, res: http.ServerResponse) => void} The handler.
 */
function createRequestHandler(
  serverFactory: McpSessionServerFactory,
  settings: McpSettings,
  getPort: () => number,
): (req: http.IncomingMessage, res: http.ServerResponse) => void {
  return (req: http.IncomingMessage, res: http.ServerResponse) => {
    void handleRequest(req, res);
  };

  async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const port = getPort();
    if (!originIsAllowed(req, port)) {
      log.warn(LOG_MCP_HTTP_REJECTED, 'origin', req.headers.origin);
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32600, message: 'Forbidden origin' }, id: null }));
      return;
    }
    if (!isAuthorized(req, settings.token)) {
      log.warn(LOG_MCP_HTTP_REJECTED, 'unauthorized request');
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ jsonrpc: '2.0', error: { code: -32600, message: 'Unauthorized: missing or invalid bearer token' }, id: null }),
      );
      return;
    }
    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
      log.warn(LOG_MCP_HTTP_REJECTED, 'method', req.method);
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32600, message: 'Method not allowed' }, id: null }));
      return;
    }
    if (!normalizeMcpPath(req.url)) {
      log.warn(LOG_MCP_HTTP_REJECTED, 'path', req.url);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32600, message: 'Not found' }, id: null }));
      return;
    }

    const sessionId = typeof req.headers['mcp-session-id'] === 'string' ? req.headers['mcp-session-id'] : undefined;
    const id = sessionId;
    const existing = id ? sessions.get(id) : undefined;
    let transport = existing?.transport;

    if (!transport) {
      const created = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        // Short keep-alive so SSE headers flush quickly after connect (keeps
        // minimal server-initiated streams alive without a priming event).
        keepAliveMs: 1000,
        onsessioninitialized: (sid) => {
          sessions.set(sid, { transport: created, server: sessionServer });
        },
      });
      let sessionServer: McpServer;
      try {
        sessionServer = await serverFactory();
        // Wire this session's transport into its own McpServer so incoming
        // JSON-RPC messages are dispatched and responses flow back over SSE.
        await sessionServer.connect(created);
      } catch (err) {
        log.warn(LOG_MCP_HTTP_REJECTED, 'session start failed:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end();
        return;
      }
      transport = created;
      created.onclose = () => {
        if (id) sessions.delete(id);
        void sessionServer.close().catch((err: Error) => log.warn(LOG_MCP_HTTP_REJECTED, 'session close failed:', err));
      };
      created.onerror = (err: Error) => log.warn(LOG_MCP_HTTP_REJECTED, 'transport error:', err);
    }

    try {
      await transport.handleRequest(req, res);
    } catch (err) {
      log.warn(LOG_MCP_HTTP_REJECTED, 'handler error:', err);
      if (!res.writableEnded) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end();
      }
    }
  }
}

/**
 * Starts the embedded MCP HTTP server on 127.0.0.1 using the given settings.
 *
 * A fresh session server is created per HTTP session (MCP sessions each own a
 * Protocol instance) via `serverFactory`; every session should share the same
 * underlying engine (job manager, transcoders).
 *
 * When the port is already taken the promise rejects; callers should surface
 * this as an audible failure rather than crashing the app.
 *
 * @param {McpSessionServerFactory} serverFactory - Builds one MCP server per
 *   session.
 * @param {McpSettings} settings - Settings controlling bind port and token.
 * @returns {Promise<McpHttpHandle>} Handle to stop the server and read the
 *   live bound port.
 */
export function startMcpHttpServer(serverFactory: McpSessionServerFactory, settings: McpSettings): Promise<McpHttpHandle> {
  let boundPort = -1;
  const httpServer: Server = http.createServer(createRequestHandler(serverFactory, settings, () => boundPort));

  return new Promise((resolve, reject) => {
    httpServer.once('error', (err) => {
      log.error(LOG_MCP_HTTP_START_FAILED, err);
      reject(err);
    });

    httpServer.listen(settings.port, '127.0.0.1', () => {
      httpServer.removeListener('error', reject);
      const address = httpServer.address();
      boundPort = typeof address === 'object' && address ? address.port : settings.port;
      log.info(LOG_MCP_HTTP_STARTED, `http://127.0.0.1:${boundPort}${MCP_HTTP_PATH}`);
      resolve({
        port: () => boundPort,
        close: () =>
          new Promise<void>((closeResolve) => {
            const transportCloses = [...sessions.values()].map((session) => session.transport.close().catch(() => undefined));
            Promise.all(transportCloses)
              .then(() => {
                sessions.clear();
                httpServer.closeAllConnections?.();
                httpServer.close(() => {
                  log.info(LOG_MCP_HTTP_STOPPED);
                  closeResolve();
                });
              })
              .catch(() => {
                sessions.clear();
                httpServer.closeAllConnections?.();
                httpServer.close(() => {
                  log.info(LOG_MCP_HTTP_STOPPED);
                  closeResolve();
                });
              });
          }),
      });
    });
  });
}
