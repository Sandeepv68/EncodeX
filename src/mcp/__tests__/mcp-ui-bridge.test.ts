/**
 * @fileoverview Executes the inline MCP Apps scripts served inside EncodeX views
 * and drives a fake host, so the handshake and each view's rendering are
 * verified as running code rather than only as string fixtures.
 */

import { describe, it, expect, vi } from 'vitest';
import { QUEUE_VIEW_HTML } from '../ui/views/queue';
import { JOB_VIEW_HTML } from '../ui/views/job';
import { MEDIA_INFO_VIEW_HTML } from '../ui/views/media-info';
import { CONVERT_VIEW_HTML } from '../ui/views/convert';

/**
 * Extracts every inline `<script>` body from a view document, in order.
 * @param {string} html - The full view HTML.
 * @returns {string[]} The script sources (without tags).
 */
function extractScripts(html: string): string[] {
  const matches = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script[^>]*>/gi)];
  if (matches.length === 0) throw new Error('view HTML has no inline script');
  return matches.map((match) => match[1]);
}

/**
 * Extracts the `<body>` inner HTML from a view document. Script tags are inert
 * until we evaluate them explicitly.
 * @param {string} html - The full view HTML.
 * @returns {string} The body inner HTML.
 */
function extractBody(html: string): string {
  return html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('</body>'));
}

/**
 * Loads a view document and evaluates its inline scripts in order.
 * @param {string} html - The full view HTML.
 * @returns {void}
 */
function bootView(html: string): void {
  document.body.innerHTML = extractBody(html);
  for (const script of extractScripts(html)) new Function(script)();
}

/**
 * Starts a fake MCP Apps host that answers `ui/initialize` and, when a
 * responder is supplied, proxies `tools/call` requests back to the view.
 * @param {(name: string, args: Record<string, unknown>) => unknown} [respond] - Tools/call responder.
 * @returns {{ seen: Array<Record<string, unknown>>; calls: Array<{ name: unknown; args: unknown }>; stop: () => void }} Host handle.
 */
function startHost(respond?: (name: string, args: Record<string, unknown>) => unknown): {
  seen: Array<Record<string, unknown>>;
  calls: Array<{ name: unknown; args: unknown }>;
  stop: () => void;
} {
  const seen: Array<Record<string, unknown>> = [];
  const calls: Array<{ name: unknown; args: unknown }> = [];
  const onHostMessage = (event: MessageEvent): void => {
    // Trust only same-origin messages. jsdom's postMessage leaves event.origin
    // empty, so treat that as the local test window; any other origin is a
    // foreign window and must not be serviced.
    if (event.origin !== '' && event.origin !== window.location.origin) return;
    const message = event.data as Record<string, unknown> | null;
    if (!message || message.jsonrpc !== '2.0') return;
    seen.push(message);
    if (message.method === 'ui/initialize') {
      window.postMessage(
        {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: '2026-01-26',
            hostInfo: { name: 'test-host', version: '1.0.0' },
            hostCapabilities: {},
            hostContext: { theme: 'dark', styles: { variables: { '--color-text-primary': '#ffffff' } } },
          },
        },
        '*',
      );
    } else if (message.method === 'tools/call') {
      const params = (message.params || {}) as { name?: unknown; arguments?: unknown };
      calls.push({ name: params.name, args: params.arguments });
      const result = respond ? respond(String(params.name), (params.arguments || {}) as Record<string, unknown>) : {};
      window.postMessage({ jsonrpc: '2.0', id: message.id, result }, '*');
    }
  };
  window.addEventListener('message', onHostMessage);
  return { seen, calls, stop: () => window.removeEventListener('message', onHostMessage) };
}

/**
 * Posts a `ui/notifications/tool-result` to the view.
 * @param {Record<string, unknown>} structuredContent - The tool's structured content.
 * @returns {void}
 */
function pushToolResult(structuredContent: Record<string, unknown>): void {
  window.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent } }, '*');
}

describe('MCP Apps view bridges', () => {
  it('queue: completes the handshake, applies host theme, and renders jobs', async () => {
    const host = startHost();
    try {
      bootView(QUEUE_VIEW_HTML);

      await vi.waitFor(() => {
        expect(host.seen.some((message) => message.method === 'ui/notifications/initialized')).toBe(true);
      });
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(document.documentElement.style.getPropertyValue('--color-text-primary')).toBe('#ffffff');

      pushToolResult({
        jobs: [
          { id: 'j1', input: 'C:/media/in.mp4', output: 'C:/media/out.mp4', status: 'running', progress: 42 },
          { id: 'j2', input: 'C:/media/b.mp4', output: 'C:/media/c.mp4', status: 'done', progress: 100 },
        ],
        count: 2,
      });

      await vi.waitFor(() => expect(document.querySelectorAll('#jobs li').length).toBe(2));
      expect(document.getElementById('count')?.textContent).toBe('2 jobs');
      expect(document.querySelector('#jobs li .name')?.textContent).toBe('out.mp4');
      expect(document.querySelector('#jobs li .status')?.textContent).toBe('running - 42%');
      expect((document.querySelector('#jobs li .bar > span') as HTMLElement).style.width).toBe('42%');
    } finally {
      host.stop();
    }
  });

  it('reports its content size so hosts can size the iframe', async () => {
    const host = startHost();
    try {
      bootView(QUEUE_VIEW_HTML);

      await vi.waitFor(() => {
        const message = host.seen.find((candidate) => candidate.method === 'ui/notifications/size-changed');
        expect(message).toBeDefined();
        const params = message?.params as { width?: unknown; height?: unknown } | undefined;
        expect(typeof params?.width).toBe('number');
        expect(typeof params?.height).toBe('number');
      });
    } finally {
      host.stop();
    }
  });

  it('job: renders a single job with paths and progress', async () => {
    const host = startHost();
    try {
      bootView(JOB_VIEW_HTML);
      pushToolResult({
        job: { id: 'j9', input: 'C:/in/a.mov', output: 'C:/out/a.mp4', status: 'running', progress: 33 },
      });

      await vi.waitFor(() => expect(document.getElementById('card')?.hidden).toBe(false));
      expect(document.getElementById('title')?.textContent).toBe('a.mp4');
      expect(document.getElementById('status')?.textContent).toBe('running - 33%');
      expect(document.getElementById('input')?.textContent).toBe('C:/in/a.mov');
      expect(document.getElementById('output')?.textContent).toBe('C:/out/a.mp4');
      expect((document.getElementById('fill') as HTMLElement).style.width).toBe('33%');
      expect(document.getElementById('error')?.hidden).toBe(true);
    } finally {
      host.stop();
    }
  });

  it('media-info: renders container facts and stream rows', async () => {
    const host = startHost();
    try {
      bootView(MEDIA_INFO_VIEW_HTML);
      pushToolResult({
        media: {
          file: 'C:/x/clip.mkv',
          format: 'matroska,webm',
          duration: 3725,
          size: 1572864,
          bitrate: '3200k',
          streams: [
            { index: 0, type: 'video', codec: 'h264', width: 1920, height: 1080, frameRate: '30/1', pixelFormat: 'yuv420p' },
            { index: 1, type: 'audio', codec: 'aac', sampleRate: 48000, channels: 2, channelLayout: 'stereo' },
          ],
        },
      });

      await vi.waitFor(() => expect(document.querySelectorAll('#streams tr').length).toBe(2));
      expect(document.getElementById('title')?.textContent).toBe('clip.mkv');
      expect(document.getElementById('duration')?.textContent).toBe('1:02:05');
      expect(document.getElementById('size')?.textContent).toBe('1.5 MB');
      expect(document.querySelectorAll('#streams tr')[0].textContent).toContain('1920 x 1080');
      expect(document.querySelectorAll('#streams tr')[1].textContent).toContain('stereo');
    } finally {
      host.stop();
    }
  });

  it('convert: submits the form, starts a job, and renders it', async () => {
    const host = startHost((name, args) => {
      if (name === 'convert_media') {
        return { structuredContent: { job: { id: 'c1', input: args.input, output: 'C:/out/movie.mp4', status: 'queued', progress: 0 } } };
      }
      return { structuredContent: {} };
    });
    try {
      bootView(CONVERT_VIEW_HTML);
      (document.getElementById('input') as HTMLInputElement).value = 'C:/in/movie.mov';
      (document.getElementById('videoCodec') as HTMLInputElement).value = 'libx264';
      (document.getElementById('submit') as HTMLButtonElement).click();

      await vi.waitFor(() => expect(host.calls.some((call) => call.name === 'convert_media')).toBe(true));
      const call = host.calls.find((candidate) => candidate.name === 'convert_media');
      expect(call?.args).toMatchObject({ input: 'C:/in/movie.mov', videoCodec: 'libx264' });

      await vi.waitFor(() => expect(document.getElementById('result')?.hidden).toBe(false));
      expect(document.getElementById('status')?.textContent).toBe('queued - 0%');
      expect(document.getElementById('r-output')?.textContent).toBe('C:/out/movie.mp4');
    } finally {
      host.stop();
    }
  });

  it('job: renders hostile metadata as inert text (no element injection)', async () => {
    const host = startHost();
    try {
      bootView(JOB_VIEW_HTML);
      const hostile = '<img src=x onerror=alert(1)>';
      pushToolResult({ job: { id: 'x', input: hostile, output: `${hostile}.mp4`, status: 'running', progress: 5 } });

      await vi.waitFor(() => expect(document.getElementById('status')?.textContent).toBe('running - 5%'));
      expect(document.querySelectorAll('#card img')).toHaveLength(0);
      expect(document.getElementById('title')?.childElementCount).toBe(0);
      expect(document.getElementById('title')?.textContent).toContain('onerror=alert(1)');
    } finally {
      host.stop();
    }
  });

  it('job: arms cancel, then calls cancel_job only on the second click', async () => {
    const host = startHost(() => ({ structuredContent: {} }));
    try {
      bootView(JOB_VIEW_HTML);
      pushToolResult({ job: { id: 'j5', input: 'C:/in/a.mov', output: 'C:/out/a.mp4', status: 'running', progress: 10 } });

      await vi.waitFor(() => expect(document.getElementById('status')?.textContent).toBe('running - 10%'));
      const cancel = document.getElementById('cancel') as HTMLButtonElement;

      cancel.click();
      expect(cancel.getAttribute('data-confirm')).toBe('1');
      expect(cancel.textContent).toBe('Confirm cancel');
      expect(host.calls).toHaveLength(0);

      cancel.click();
      await vi.waitFor(() => expect(host.calls.some((call) => call.name === 'cancel_job')).toBe(true));
      expect(host.calls.find((candidate) => candidate.name === 'cancel_job')?.args).toMatchObject({ jobId: 'j5' });
    } finally {
      host.stop();
    }
  });
});
