/**
 * @fileoverview Tests for the user-approval gate helpers used by mutating MCP
 * tools ({@link hostSupportsMcpApps}, {@link confirmationField},
 * {@link confirmationDetails}, {@link confirmationResult},
 * {@link confirmationViewUri}).
 *
 * `hostSupportsMcpApps` only reads live client capabilities from the server, so
 * a plain fake server object drives it without any SDK wiring.
 */

import { describe, it, expect } from 'vitest';
import {
  COMMIT_OPERATION_TOOL,
  CONFIRMABLE_OPERATIONS,
  confirmationDetails,
  confirmationField,
  confirmationResult,
  confirmationViewUri,
  hostSupportsMcpApps,
} from '../ui/approval';
import { MCP_UI_EXTENSION_ID, MCP_UI_VIEW_URIS, MCP_UI_RESOURCE_MIME_TYPE } from '../../shared/mcp-ui';
import type { McpServer } from '@modelcontextprotocol/server';
import type { McpUiConfirmation } from '../../shared/mcp-ui';

/** A minimal McpServer double exposing the client capabilities. */
function fakeServer(capabilities: unknown): McpServer {
  return { server: { getClientCapabilities: () => capabilities } } as unknown as McpServer;
}

describe('hostSupportsMcpApps', () => {
  it('is true when the client advertises the UI extension', () => {
    const server = fakeServer({ extensions: { [MCP_UI_EXTENSION_ID]: { mimeTypes: [MCP_UI_RESOURCE_MIME_TYPE] } } });
    expect(hostSupportsMcpApps(server)).toBe(true);
  });

  it('is false when the client reports no capabilities at all', () => {
    expect(hostSupportsMcpApps(fakeServer(undefined))).toBe(false);
  });

  it('is false when the UI extension is absent from the capabilities', () => {
    expect(hostSupportsMcpApps(fakeServer({ extensions: {} }))).toBe(false);
  });
});

describe('commit_operation contract', () => {
  it('names the app-only executor and keeps the confirmable list in sync', () => {
    expect(COMMIT_OPERATION_TOOL).toBe('commit_operation');
    expect(CONFIRMABLE_OPERATIONS).toEqual([
      'convert_media',
      'compress_image',
      'extract_audio',
      'cut_video',
      'batch_convert',
      'remux_media',
      'demux_media',
      'execute_workflow',
    ]);
  });
});

describe('confirmationField', () => {
  it('drops undefined, null and empty values', () => {
    expect(confirmationField('Output', undefined)).toBeUndefined();
    expect(confirmationField('Output', null)).toBeUndefined();
    expect(confirmationField('Output', '')).toBeUndefined();
  });

  it('strings scalar values so views render something readable', () => {
    expect(confirmationField('Output', 'C:\\out.mp4')).toEqual({ label: 'Output', value: 'C:\\out.mp4' });
    expect(confirmationField('Quality', 23)).toEqual({ label: 'Quality', value: '23' });
  });
});

describe('confirmationDetails', () => {
  it('keeps only the defined rows', () => {
    const rows = [
      confirmationField('Output', 'C:\\out.mp4'),
      confirmationField('Quality', undefined),
      confirmationField('Cut', '00:01:00'),
    ];
    expect(confirmationDetails(rows)).toEqual([
      { label: 'Output', value: 'C:\\out.mp4' },
      { label: 'Cut', value: '00:01:00' },
    ]);
  });

  it('returns an empty array when every row is undefined', () => {
    expect(confirmationDetails([unconfirmationField(), unconfirmationField()])).toEqual([]);
  });

  /** Builds a row the shape requires to be filtered out. */
  function unconfirmationField() {
    return undefined;
  }
});

describe('confirmationResult', () => {
  it('wraps the confirmation in text and structured content', () => {
    const confirmation: McpUiConfirmation = {
      operation: 'compress_image',
      title: 'Compress image',
      summary: 'Compress cover.jpg to webp',
      args: { input: 'cover.jpg' },
    };
    const result = confirmationResult(confirmation);
    expect(result.structuredContent).toEqual({ confirmation });
    const text = JSON.parse((result.content[0] as { type: 'text'; text: string }).text);
    expect(text).toMatchObject({
      status: 'awaiting-confirmation',
      operation: 'compress_image',
      summary: 'Compress cover.jpg to webp',
      args: { input: 'cover.jpg' },
    });
  });
});

describe('confirmationViewUri', () => {
  it('routes convert_media and batch_convert to their bespoke views', () => {
    expect(confirmationViewUri('convert_media')).toBe(MCP_UI_VIEW_URIS.convert);
    expect(confirmationViewUri('batch_convert')).toBe(MCP_UI_VIEW_URIS.batch);
  });

  it('falls back to the generic confirm view for every other tool', () => {
    expect(confirmationViewUri('cut_video')).toBe(MCP_UI_VIEW_URIS.confirm);
    expect(confirmationViewUri('compress_image')).toBe(MCP_UI_VIEW_URIS.confirm);
  });
});
