/**
 * @fileoverview Tests for the standalone MCP App host.
 *
 * The standalone bundle runs inside a third-party host's sandboxed iframe and
 * talks to it over the MCP Apps `postMessage` protocol. The `ext-apps` `App`
 * class owns the handshake, so this adapter only has to translate its events
 * into the host contract the views use.
 */

import { describe, it, expect } from 'vitest';
import { AppExtAppsHost } from '../standalone/AppExtAppsHost';

/**
 * A stand-in for the `ext-apps` `App` class.
 * @returns {object} The fake app and the recorded state.
 */
function fakeApp() {
  const state = {
    ontoolresult: undefined as ((params: unknown) => void) | undefined,
    onhostcontextchanged: undefined as ((params: unknown) => void) | undefined,
    connected: false,
    calls: [] as Array<{ name: string; args: Record<string, unknown> }>,
    hostContext: {
      theme: 'dark',
      styles: { variables: { '--color-background-primary': '#101014' } },
      locale: 'en-US',
      capabilities: { serverTools: {} },
    } as Record<string, unknown>,
  };
  const app = {
    set ontoolresult(callback: ((params: unknown) => void) | undefined) {
      state.ontoolresult = callback;
    },
    get ontoolresult() {
      return state.ontoolresult;
    },
    set onhostcontextchanged(callback: ((params: unknown) => void) | undefined) {
      state.onhostcontextchanged = callback;
    },
    async connect() {
      state.connected = true;
    },
    async callServerTool(params: { name: string; arguments?: Record<string, unknown> }) {
      state.calls.push({ name: params.name, args: params.arguments ?? {} });
      return { content: [{ type: 'text', text: 'ok' }], structuredContent: { value: 1 } };
    },
    getHostContext() {
      return state.hostContext;
    },
  };
  return { app, state };
}

describe('AppExtAppsHost', () => {
  it('connects and reports the host context', async () => {
    const { app, state } = fakeApp();
    const host = new AppExtAppsHost(app as never);
    await host.connect();
    expect(state.connected).toBe(true);
    expect(host.context.theme).toBe('dark');
    expect(host.context.variables['--color-background-primary']).toBe('#101014');
    expect(host.context.locale).toBe('en-US');
    expect(host.context.supportsServerTools).toBe(true);
  });

  it('calls a tool through the host proxy', async () => {
    const { app, state } = fakeApp();
    const host = new AppExtAppsHost(app as never);
    await host.connect();
    const result = await host.callTool('list_jobs', { a: 1 });
    expect(state.calls).toEqual([{ name: 'list_jobs', args: { a: 1 } }]);
    expect(result.structuredContent).toEqual({ value: 1 });
  });

  it('pushes host tool results to the subscribers', async () => {
    const { app, state } = fakeApp();
    const host = new AppExtAppsHost(app as never);
    await host.connect();
    const received: unknown[] = [];
    const unsubscribe = host.subscribe((result) => received.push(result));
    state.ontoolresult?.({ structuredContent: { jobs: [] } });
    expect(received).toEqual([{ structuredContent: { jobs: [] } }]);
    unsubscribe();
    state.ontoolresult?.({ structuredContent: { jobs: [1] } });
    expect(received).toHaveLength(1);
  });

  it('follows a host context change', async () => {
    const { app, state } = fakeApp();
    const host = new AppExtAppsHost(app as never);
    await host.connect();
    state.onhostcontextchanged?.({ theme: 'light', styles: { variables: { '--x': '1' } } });
    expect(host.context.theme).toBe('light');
    expect(host.context.variables['--x']).toBe('1');
  });

  it('reports a host that cannot proxy tool calls', async () => {
    const { app, state } = fakeApp();
    state.hostContext = { theme: 'light', styles: { variables: {} } };
    const host = new AppExtAppsHost(app as never);
    await host.connect();
    expect(host.context.supportsServerTools).toBe(false);
  });

  it('tolerates a host that reports nothing', async () => {
    const { app, state } = fakeApp();
    state.hostContext = {};
    const host = new AppExtAppsHost(app as never);
    await host.connect();
    expect(host.context.theme).toBeUndefined();
    expect(host.context.variables).toEqual({});
    expect(host.context.locale).toBeUndefined();
  });
});
