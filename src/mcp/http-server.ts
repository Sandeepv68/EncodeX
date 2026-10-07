/**
 * @fileoverview Standalone Streamable-HTTP MCP server entry point for EncodeX.
 *
 * Run `node dist/mcp/http-server.js` to expose the same tool surface as the
 * stdio server (see `src/mcp/index.ts`) over MCP Streamable HTTP on the local
 * machine only:
 *
 *  - The server binds exclusively to `127.0.0.1` (override with `--host`, which
 *    is refused unless it is loopback) and rejects non-loopback `Host`/`Origin`
 *    headers per request, so nothing is exposed beyond the local machine.
 *  - Authentication is on by default: a random bearer token is generated on
 *    each start and printed to stdout (`MCP_HTTP_TOKEN=...`). Pin it in the MCP
 *    client config, or pass `--token <value>` / `ENCODEX_MCP_TOKEN` for a fixed
 *    token, or `--no-auth` for password-less loopback development.
 *  - Listen errors (e.g. an already-used port) print to stderr and exit 1.
 *
 * Unlike the stdio entry, stdout is not a JSON-RPC protocol stream here, so log
 * lines remain on stdout and are not redirected.
 */

import { randomBytes } from 'crypto';
import { runMcpHttpServer } from './http';

const TOKEN_FLAGS = ['--token', '--token='] as const;
const NO_AUTH_FLAGS = ['--no-auth', '--noauth'] as const;

function argValue(argv: string[], flag: string): string | undefined {
  const eq = flag.endsWith('=') ? flag.slice(0, -1) : flag;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === eq) return argv[i + 1];
    if (argv[i].startsWith(`${eq}=`)) return argv[i].slice(eq.length + 1);
  }
  return undefined;
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

function resolveHost(argv: string[]): string {
  return argValue(argv, '--host') ?? '127.0.0.1';
}

function resolvePort(argv: string[]): number {
  const raw = argValue(argv, '--port');
  const parsed = raw === undefined ? 0 : Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65_535) {
    throw new Error(`Invalid --port value: ${raw}`);
  }
  return parsed;
}

function resolveBasePath(argv: string[]): string {
  const raw = argValue(argv, '--base-path') ?? '/mcp';
  if (!raw.startsWith('/')) throw new Error('--base-path must start with "/".');
  return raw;
}

function resolveMaxSessions(argv: string[]): number {
  const raw = argValue(argv, '--max-sessions');
  const parsed = raw === undefined ? 64 : Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`Invalid --max-sessions value: ${raw}`);
  return parsed;
}

/** Resolves the bearer token: explicit token > no-auth > a fresh random token. */
function resolveBearerToken(argv: string[]): string | undefined {
  if (NO_AUTH_FLAGS.some((f) => hasFlag(argv, f))) return undefined;
  const explicit = argValue(argv, '--token');
  if (explicit !== undefined) return explicit;
  if (process.env.ENCODEX_MCP_TOKEN) return process.env.ENCODEX_MCP_TOKEN;
  return randomBytes(32).toString('hex');
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const bearerToken = resolveBearerToken(argv);
  if (bearerToken) {
    console.log(`MCP_HTTP_TOKEN=${bearerToken}`);
  }
  await runMcpHttpServer({
    host: resolveHost(argv),
    port: resolvePort(argv),
    basePath: resolveBasePath(argv),
    maxSessions: resolveMaxSessions(argv),
    bearerToken,
  });
}

main().catch((err: unknown) => {
  console.error('EncodeX MCP HTTP server failed to start:', err);
  process.exit(1);
});
