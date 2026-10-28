/**
 * @fileoverview Integration coverage for the MCP server's raw stdio plumbing.
 *
 * The transport reads and writes file descriptors instead of
 * `process.stdin` / `process.stdout`, because Electron's main process does not
 * relay the piped standard streams. These cases drive the real descriptors -
 * a file on disk - rather than a stubbed stream, so the read and write loops
 * are exercised the way the server exercises them.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough } from 'stream';
import { createStdinInput } from '../stdin';
import { createStdout, writeAll } from '../stdout';

describe('createStdinInput (integration)', () => {
  let dir = '';

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-mcp-stdio-int-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('keeps a Node stream unchanged when not running under Electron', () => {
    const source = new PassThrough();
    const input = createStdinInput(false, source);
    expect(input).toBe(source);
  });

  it('never ends when running under Electron', async () => {
    const source = new PassThrough();
    const input = createStdinInput(true, source);
    let ended = false;
    input.on('end', () => {
      ended = true;
    });
    source.end();
    await new Promise((resolve) => setImmediate(resolve));
    expect(ended).toBe(false);
  });

  it('reads the frames the host wrote to the descriptor', async () => {
    const file = path.join(dir, 'in.jsonl');
    fs.writeFileSync(file, '{"jsonrpc":"2.0","id":1}\n');
    const fd = fs.openSync(file, 'r');
    try {
      const input = createStdinInput(false, undefined, fd);
      const chunks: Buffer[] = [];
      input.on('data', (chunk: Buffer) => chunks.push(chunk));
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(Buffer.concat(chunks).toString()).toContain('"id":1');
    } finally {
      fs.closeSync(fd);
    }
  });

  it('ends the stream when the host closed its end of the pipe', async () => {
    const file = path.join(dir, 'empty.jsonl');
    fs.writeFileSync(file, '');
    const fd = fs.openSync(file, 'r');
    try {
      const input = createStdinInput(false, undefined, fd);
      input.resume();
      await new Promise((resolve) => input.on('end', resolve));
      expect(input.readableEnded).toBe(true);
    } finally {
      fs.closeSync(fd);
    }
  });

  it('fails the stream when the descriptor is gone', async () => {
    const file = path.join(dir, 'gone.jsonl');
    fs.writeFileSync(file, 'x');
    const fd = fs.openSync(file, 'r');
    fs.closeSync(fd);
    const input = createStdinInput(false, undefined, fd);
    input.resume();
    await expect(new Promise((resolve, reject) => input.on('error', reject))).rejects.toThrow();
  });
});

describe('the MCP stdout writer (integration)', () => {
  let dir = '';

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-mcp-stdout-int-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes a whole frame to the descriptor', async () => {
    const file = path.join(dir, 'out.jsonl');
    const fd = fs.openSync(file, 'w');
    try {
      const stdout = createStdout(fd);
      await new Promise<void>((resolve, reject) => {
        stdout.write('{"jsonrpc":"2.0","id":1}\n', (error) => (error ? reject(error) : resolve()));
      });
      stdout.end();
      expect(fs.readFileSync(file, 'utf8')).toBe('{"jsonrpc":"2.0","id":1}\n');
    } finally {
      fs.closeSync(fd);
    }
  });

  it('writes a frame larger than one pipe buffer', async () => {
    const file = path.join(dir, 'big.jsonl');
    const fd = fs.openSync(file, 'w');
    try {
      const frame = `${'x'.repeat(1024 * 1024)}\n`;
      await writeAll(fd, Buffer.from(frame));
      expect(fs.statSync(file).size).toBe(frame.length);
    } finally {
      fs.closeSync(fd);
    }
  });

  it('reports a descriptor that is gone', async () => {
    const file = path.join(dir, 'gone.jsonl');
    const fd = fs.openSync(file, 'w');
    fs.closeSync(fd);
    await expect(writeAll(fd, Buffer.from('never written'))).rejects.toThrow();
  });
});

describe('the standalone entry point bootstrap (integration)', () => {
  it('keeps the protocol stream clean by routing log lines to stderr', async () => {
    const originalLog = console.log;
    const originalWrite = process.stderr.write;
    const written: string[] = [];
    process.stderr.write = ((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    }) as unknown as typeof process.stderr.write;
    try {
      await import('../stdio-bootstrap');
      console.log('mcp stdout probe');
    } finally {
      process.stderr.write = originalWrite;
      console.log = originalLog;
    }
    expect(written.join('')).toContain('mcp stdout probe');
  });
});
