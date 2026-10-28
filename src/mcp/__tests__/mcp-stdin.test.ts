/**
 * @fileoverview Tests for the MCP server's stdin stream.
 *
 * The MCP 2.x stdio transport closes itself the moment its input ends. Under
 * Electron the descriptor reaches end-of-file as soon as the process starts,
 * so the input must forward the data without ever ending - otherwise the
 * session dies before the client gets an answer.
 */

import { describe, it, expect } from 'vitest';
import { PassThrough, Readable } from 'stream';
import { createStdinInput } from '../stdin';

describe('createStdinInput', () => {
  it('returns the source unchanged outside Electron', () => {
    const source = new PassThrough();
    expect(createStdinInput(false, source)).toBe(source);
  });

  it('forwards the data under Electron', async () => {
    const source = new PassThrough();
    const input = createStdinInput(true, source);
    const chunks: Buffer[] = [];
    input.on('data', (chunk: Buffer) => chunks.push(chunk));
    source.write('hello');
    await new Promise((resolve) => setImmediate(resolve));
    expect(Buffer.concat(chunks).toString()).toBe('hello');
  });

  it('never ends the stream under Electron', async () => {
    const source = new PassThrough();
    const input = createStdinInput(true, source);
    let ended = false;
    input.on('end', () => {
      ended = true;
    });
    source.end();
    await new Promise((resolve) => setImmediate(resolve));
    expect(ended).toBe(false);
    expect(input.readableEnded).toBe(false);
  });

  it('swallows a source error under Electron', async () => {
    const source = new PassThrough();
    const input = createStdinInput(true, source);
    expect(() => source.emit('error', new Error('boom'))).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
    expect(input).toBeInstanceOf(Readable);
  });
});
