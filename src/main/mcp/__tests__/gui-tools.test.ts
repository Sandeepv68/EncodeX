import { describe, it, expect } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGuiTools } from '../gui-tools';
import { MCPJobManager } from '../../../mcp/jobs/manager';
import { FakeTranscoder } from '../../../mcp/__tests__/test-helpers';
import type { ITranscoder } from '../../transcoders/types';
import type { MediaInfo } from '../../../shared/types';
import type { GuiToolsDeps } from '../gui-tools';

/**
 * A media-info-capable fake whose probe reports a 1920x1080, 30fps video.
 * @class TimelineTranscoder
 */
class TimelineTranscoder extends FakeTranscoder {
  async getInfo(input: string): Promise<MediaInfo> {
    return {
      file: input,
      format: 'mov,mp4,m4a',
      size: 1024 * 1024,
      duration: 42,
      bitrate: '2000k',
      streams: [
        {
          index: 0,
          type: 'video',
          codec: 'h264',
          width: 1920,
          height: 1080,
          frameRate: '30/1',
          avgFrameRate: '30/1',
        },
        { index: 1, type: 'audio', codec: 'aac' },
      ],
    };
  }
}

/**
 * A connected MCP session running only the GUI-parity tools.
 * @interface GuiSession
 * @property {Client} client - The MCP client.
 * @property {MCPJobManager} jobManager - The shared (fake-backed) job manager.
 * @property {() => Promise<void>} close - Closes the client connection.
 */
interface GuiSession {
  client: Client;
  jobManager: MCPJobManager;
  close: () => Promise<void>;
}

/**
 * Builds a server with {@link registerGuiTools} using the given fake overrides
 * and returns a connected client session.
 * @param {Partial<GuiToolsDeps>} [overrides] - Overrides for the injected deps.
 * @returns {Promise<GuiSession>} The connected session.
 */
async function setup(overrides: Partial<GuiToolsDeps> = {}): Promise<GuiSession> {
  const jobManager = new MCPJobManager({ transcoderFactory: () => new FakeTranscoder() });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = new McpServer({ name: 'encodex-gui-test', version: '1.0.0' });
  registerGuiTools(server, {
    jobManager,
    appVersion: '1.0.0-beta.4',
    transcoderFactory: () => new TimelineTranscoder(),
    getPreviewFrame: async () => 'data:image/png;base64,cHJldmlldw==',
    checkForUpdate: async () => null,
    ...overrides,
  });
  await server.connect(serverTransport);
  const client = new Client({ name: 'mcp-gui-test-client', version: '1.0.0' });
  await client.connect(clientTransport);
  return { client, jobManager, close: () => client.close() };
}

/**
 * JSON-parses the first text content of a CallToolResult.
 * @param {any} result - A CallToolResult.
 * @returns {string} The joined text content.
 */
function textOf(result: any): string {
  return (result.content ?? [])
    .filter((c: { type?: string }) => c.type === 'text')
    .map((c: { text: string }) => c.text)
    .join('');
}

describe('registerGuiTools', () => {
  it('registers all six GUI-parity tools with full deps', async () => {
    const session = await setup();
    const tools = await session.client.listTools();
    await session.close();
    const names = tools.tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'get_queue_state',
        'cancel_all_jobs',
        'get_timeline',
        'extract_preview',
        'get_system_info',
        'check_for_updates',
      ]),
    );
  });

  it('omits optional capability tools when their deps are missing', async () => {
    const session = await setup({ transcoderFactory: undefined, getPreviewFrame: undefined, checkForUpdate: undefined });
    const tools = await session.client.listTools();
    await session.close();
    const names = tools.tools.map((t) => t.name);
    expect(names).toContain('get_queue_state');
    expect(names).toContain('cancel_all_jobs');
    expect(names).toContain('get_system_info');
    expect(names).not.toContain('get_timeline');
    expect(names).not.toContain('extract_preview');
    expect(names).not.toContain('check_for_updates');
  });

  it('get_queue_state reports enrolled jobs and pending count', async () => {
    const session = await setup();
    session.jobManager.enqueue('C:\\in.mp4', 'C:\\out.mp4', { videoCodec: 'libx264' });
    const parsed = JSON.parse(textOf(await session.client.callTool({ name: 'get_queue_state', arguments: {} })));
    await session.close();
    expect(Array.isArray(parsed.jobs)).toBe(true);
    expect(parsed.jobs.length).toBeGreaterThan(0);
    expect(parsed.jobs[0].input).toBe('C:\\in.mp4');
    expect(typeof parsed.pending).toBe('number');
  });

  it('cancel_all_jobs clears the shared queue', async () => {
    const session = await setup();
    session.jobManager.enqueue('C:\\in1.mp4', 'C:\\out1.mp4', { videoCodec: 'libx264' });
    session.jobManager.enqueue('C:\\in2.mp4', 'C:\\out2.mp4', { videoCodec: 'libx264' });
    const cancel = JSON.parse(textOf(await session.client.callTool({ name: 'cancel_all_jobs', arguments: {} })));
    expect(cancel).toEqual({ cancelled: true });
    const parsed = JSON.parse(textOf(await session.client.callTool({ name: 'get_queue_state', arguments: {} })));
    await session.close();
    expect(parsed.jobs.length).toBe(0);
    expect(parsed.pending).toBe(0);
  });

  it('get_timeline probes duration, fps, and resolution', async () => {
    const session = await setup();
    const parsed = JSON.parse(textOf(await session.client.callTool({ name: 'get_timeline', arguments: { input: 'C:\\clip.mp4' } })));
    await session.close();
    expect(parsed.duration).toBe(42);
    expect(parsed.fps).toBe('30/1');
    expect(parsed.width).toBe(1920);
    expect(parsed.height).toBe(1080);
    expect(parsed.codec).toBe('h264');
  });

  it('extract_preview echoes the data URL', async () => {
    const session = await setup();
    const parsed = JSON.parse(textOf(await session.client.callTool({ name: 'extract_preview', arguments: { input: 'C:\\clip.mp4' } })));
    await session.close();
    expect(parsed.dataUrl).toBe('data:image/png;base64,cHJldmlldw==');
  });

  it('extract_preview reports an error when no frame can be extracted', async () => {
    const session = await setup({ getPreviewFrame: async () => null });
    const result = await session.client.callTool({ name: 'extract_preview', arguments: { input: 'C:\\broken.mp4' } });
    await session.close();
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Could not extract a preview frame');
  });

  it('get_system_info reports app version and platform', async () => {
    const session = await setup();
    const parsed = JSON.parse(textOf(await session.client.callTool({ name: 'get_system_info', arguments: {} })));
    await session.close();
    expect(parsed.appVersion).toBe('1.0.0-beta.4');
    expect(parsed.platform).toBe(process.platform);
    expect(parsed.os).toBeDefined();
    expect(typeof parsed.os.totalMemory).toBe('number');
  });

  it('check_for_updates reports up to date when none is found', async () => {
    const session = await setup({ checkForUpdate: async () => null });
    const parsed = JSON.parse(textOf(await session.client.callTool({ name: 'check_for_updates', arguments: {} })));
    await session.close();
    expect(parsed.available).toBe(false);
    expect(parsed.current).toBe('1.0.0-beta.4');
  });

  it('check_for_updates reports the latest release when one exists', async () => {
    const session = await setup({
      checkForUpdate: async () => ({
        version: '2.0.0',
        releaseNotes: 'notes',
        releaseUrl: 'https://github.com/anomalyco/EncodeX/releases/v2.0.0',
        asset: { name: 'EncodeX-2.0.0.exe', url: 'https://example.com/EncodeX-2.0.0.exe', size: 12 },
      }),
    });
    const parsed = JSON.parse(textOf(await session.client.callTool({ name: 'check_for_updates', arguments: {} })));
    await session.close();
    expect(parsed.available).toBe(true);
    expect(parsed.latest).toBe('2.0.0');
    expect(parsed.releaseUrl).toContain('releases/v2.0.0');
  });

  it('check_for_updates surfaces failures as tool errors', async () => {
    const session = await setup({ checkForUpdate: async () => Promise.reject(new Error('network down')) });
    const result = await session.client.callTool({ name: 'check_for_updates', arguments: {} });
    await session.close();
    expect(result.isError).toBe(true);
  });
});
