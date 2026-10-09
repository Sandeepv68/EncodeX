/**
 * @fileoverview Unit coverage for the standalone Streamable-HTTP MCP entry
 * point (`src/mcp/http-server.ts`).
 *
 * The entry is otherwise only exercised end-to-end by spawning the built
 * `dist/mcp/http-server.js`, which v8 coverage cannot see. This file imports the
 * module in-process with `../http` mocked, drives every argument shape, and
 * asserts the values handed to `runMcpHttpServer` and the token line printed to
 * stdout - so the CLI parsing and error paths carry real coverage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { runMcpHttpServerMock } = vi.hoisted(() => ({
  runMcpHttpServerMock: vi.fn((_options: Record<string, unknown>) => Promise.resolve()),
}));

vi.mock('../http', () => ({ runMcpHttpServer: runMcpHttpServerMock }));

/**
 * Imports a fresh copy of the entry point with the given CLI arguments and
 * flushes the async `main()` chain so the mock call and error handlers settle.
 *
 * @param {string[]} argv - Arguments after the program name.
 * @returns {Promise<void>} Resolves once the entry has run.
 */
async function importEntry(argv: string[]): Promise<void> {
  vi.resetModules();
  runMcpHttpServerMock.mockClear();
  process.argv = ['node', 'http-server', ...argv];
  await import('../http-server');
  await new Promise((resolve) => setImmediate(resolve));
}

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;
let savedToken: string | undefined;

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  savedToken = process.env.ENCODEX_MCP_TOKEN;
  delete process.env.ENCODEX_MCP_TOKEN;
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
  exitSpy.mockRestore();
  if (savedToken === undefined) delete process.env.ENCODEX_MCP_TOKEN;
  else process.env.ENCODEX_MCP_TOKEN = savedToken;
});

describe('http-server entry point', () => {
  it('starts on loopback with defaults and prints a fresh random token', async () => {
    await importEntry([]);
    expect(runMcpHttpServerMock).toHaveBeenCalledTimes(1);
    const options = runMcpHttpServerMock.mock.calls[0][0];
    expect(options.host).toBe('127.0.0.1');
    expect(options.port).toBe(0);
    expect(options.basePath).toBe('/mcp');
    expect(options.maxSessions).toBe(64);
    expect(options.bearerToken).toMatch(/^[0-9a-f]{64}$/);
    expect(logSpy).toHaveBeenCalledWith(`MCP_HTTP_TOKEN=${String(options.bearerToken)}`);
  });

  it('honours explicit flags including the --flag=value form', async () => {
    await importEntry(['--host=127.0.0.1', '--port', '1234', '--base-path=/alt', '--max-sessions', '5', '--token', 'secret']);
    const options = runMcpHttpServerMock.mock.calls[0][0];
    expect(options.host).toBe('127.0.0.1');
    expect(options.port).toBe(1234);
    expect(options.basePath).toBe('/alt');
    expect(options.maxSessions).toBe(5);
    expect(options.bearerToken).toBe('secret');
  });

  it('uses ENCODEX_MCP_TOKEN when no --token is given', async () => {
    process.env.ENCODEX_MCP_TOKEN = 'from-env';
    await importEntry([]);
    const options = runMcpHttpServerMock.mock.calls[0][0];
    expect(options.bearerToken).toBe('from-env');
  });

  it('disables auth for both --no-auth and --noauth', async () => {
    await importEntry(['--no-auth']);
    expect(runMcpHttpServerMock.mock.calls[0][0].bearerToken).toBeUndefined();
    expect(logSpy).not.toHaveBeenCalled();

    await importEntry(['--noauth']);
    expect(runMcpHttpServerMock.mock.calls[0][0].bearerToken).toBeUndefined();
  });

  it('rejects an out-of-range port', async () => {
    await importEntry(['--port', '70000']);
    expect(errorSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(runMcpHttpServerMock).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric port', async () => {
    await importEntry(['--port', 'abc']);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(runMcpHttpServerMock).not.toHaveBeenCalled();
  });

  it('rejects a base path that does not start with a slash', async () => {
    await importEntry(['--base-path', 'mcp']);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(runMcpHttpServerMock).not.toHaveBeenCalled();
  });

  it('rejects a max-sessions below one', async () => {
    await importEntry(['--max-sessions', '0']);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(runMcpHttpServerMock).not.toHaveBeenCalled();
  });
});
