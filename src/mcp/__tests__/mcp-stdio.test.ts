/**
 * @fileoverview Tests for the MCP server's raw stdio plumbing.
 *
 * The transport talks over file descriptors rather than `process.stdin` /
 * `process.stdout`, because Electron's main process does not relay the piped
 * standard streams. That means the server owns the read and the write, and
 * both have to survive a descriptor that is in non-blocking mode: a read that
 * finds nothing reports `EAGAIN`, and a write larger than the pipe buffer
 * goes out only partly. Node's own streams turn either into a fatal error,
 * which tears the MCP session down in the middle of a response.
 *
 * The MCP 2.x stdio transport also closes itself the moment its input ends.
 * Under Electron the descriptor reaches end-of-file as soon as the process
 * starts, so the input must forward the data without ever ending - otherwise
 * the session dies before the client gets an answer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PassThrough, Readable } from 'stream';
import { createStdinInput } from '../stdin';
import { createStdout, writeAll } from '../stdout';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual, default: actual, read: vi.fn(actual.read), write: vi.fn(actual.write) };
});

const fsMock = vi.mocked(fs);
const realFs = await vi.importActual<typeof import('fs')>('fs');

/** Temporary directory of the test fixtures. @type {string} */
let dir = '';

/**
 * Opens a temporary file the server can write to.
 * @param {string} name - The file name inside the temporary directory.
 * @returns {number} The descriptor.
 */
function openFixture(name: string): number {
  return fs.openSync(path.join(dir, name), 'w+');
}

/**
 * Opens a temporary file the server can read from.
 * @param {string} name - The file name inside the temporary directory.
 * @param {string} [content] - The content the host wrote.
 * @returns {number} The descriptor.
 */
function openReadFixture(name: string, content: string): number {
  fs.writeFileSync(path.join(dir, name), content);
  return fs.openSync(path.join(dir, name), 'r');
}

/**
 * Builds an error that looks like one the operating system reports.
 * @param {string} code - The error code.
 * @param {string} message - The error message.
 * @returns {NodeJS.ErrnoException} The error.
 */
function osError(code: string, message: string): NodeJS.ErrnoException {
  const error = new Error(message) as NodeJS.ErrnoException;
  error.code = code;
  return error;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'encodex-mcp-stdio-'));
  // The mocked descriptors fall back to the real ones between the cases that
  // provoke a specific operating-system error.
  fsMock.read.mockReset();
  fsMock.read.mockImplementation(realFs.read);
  fsMock.write.mockReset();
  fsMock.write.mockImplementation(realFs.write);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('writeAll', () => {
  it('writes the whole buffer to the descriptor', async () => {
    const fd = openFixture('write.bin');
    try {
      await writeAll(fd, Buffer.from('hello world'));
      expect(fs.readFileSync(path.join(dir, 'write.bin'), 'utf8')).toBe('hello world');
    } finally {
      fs.closeSync(fd);
    }
  });

  it('writes a frame larger than one pipe buffer', async () => {
    const fd = openFixture('big.bin');
    try {
      const frame = Buffer.alloc(1024 * 1024, 0x61);
      await writeAll(fd, frame);
      expect(fs.statSync(path.join(dir, 'big.bin')).size).toBe(frame.length);
    } finally {
      fs.closeSync(fd);
    }
  });

  it('retries when the descriptor has no room for the data', async () => {
    const fd = openFixture('again.bin');
    let calls = 0;
    fsMock.write.mockImplementation((...args: unknown[]) => {
      calls += 1;
      if (calls === 1) {
        const callback = args[args.length - 1] as (error: NodeJS.ErrnoException) => void;
        callback(osError('EAGAIN', 'resource temporarily unavailable'));
        return undefined;
      }
      return (realFs.write as (...inner: unknown[]) => unknown)(...args);
    });
    try {
      await writeAll(fd, Buffer.from('after the retry'));
      expect(calls).toBe(2);
      expect(fs.readFileSync(path.join(dir, 'again.bin'), 'utf8')).toBe('after the retry');
    } finally {
      fs.closeSync(fd);
    }
  });

  it('writes the rest of the frame after a partial write', async () => {
    const fd = openFixture('partial.bin');
    let calls = 0;
    fsMock.write.mockImplementation(((
      descriptor: number,
      buffer: Buffer,
      offset: number,
      length: number,
      position: number | null,
      callback: unknown,
    ) => {
      calls += 1;
      const size = calls === 1 ? Math.floor(length / 2) : length;
      return (realFs.write as (...inner: unknown[]) => unknown)(descriptor, buffer, offset, size, position, callback);
    }) as unknown as typeof fs.write);
    try {
      await writeAll(fd, Buffer.from('the whole frame'));
      expect(calls).toBe(2);
      expect(fs.readFileSync(path.join(dir, 'partial.bin'), 'utf8')).toBe('the whole frame');
    } finally {
      fs.closeSync(fd);
    }
  });

  it('rejects when the descriptor reports a real error', async () => {
    const fd = openFixture('boom.bin');
    fsMock.write.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (error: NodeJS.ErrnoException) => void;
      callback(osError('ENOSPC', 'no space left on device'));
      return undefined;
    });
    try {
      await expect(writeAll(fd, Buffer.from('never written'))).rejects.toThrow(/no space left/);
    } finally {
      fs.closeSync(fd);
    }
  });
});

describe('createStdout', () => {
  it('writes everything that is written to it', async () => {
    const fd = openFixture('stream.bin');
    try {
      const stdout = createStdout(fd);
      const written = new Promise<void>((resolve, reject) => {
        stdout.write('first', (error) => (error ? reject(error) : resolve()));
      });
      await written;
      stdout.end();
      expect(fs.readFileSync(path.join(dir, 'stream.bin'), 'utf8')).toBe('first');
    } finally {
      fs.closeSync(fd);
    }
  });

  it('reports a write error on the stream', async () => {
    const fd = openFixture('stream-error.bin');
    fsMock.write.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (error: NodeJS.ErrnoException) => void;
      callback(osError('EPIPE', 'broken pipe'));
      return undefined;
    });
    try {
      const stdout = createStdout(fd);
      const failed = new Promise<Error>((resolve) => stdout.on('error', resolve));
      stdout.write('doomed');
      expect((await failed).message).toMatch(/broken pipe/);
    } finally {
      fs.closeSync(fd);
    }
  });
});

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

  it('reads the data the host wrote to the descriptor', async () => {
    const fd = openReadFixture('in.bin', 'ping');
    try {
      const input = createStdinInput(false, undefined, fd);
      const chunks: Buffer[] = [];
      input.on('data', (chunk: Buffer) => chunks.push(chunk));
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(Buffer.concat(chunks).toString()).toBe('ping');
    } finally {
      fs.closeSync(fd);
    }
  });

  it('ends the stream when the host closed its end', async () => {
    const fd = openReadFixture('empty.bin', '');
    try {
      const input = createStdinInput(false, undefined, fd);
      input.resume();
      await new Promise((resolve) => input.on('end', resolve));
      expect(input.readableEnded).toBe(true);
    } finally {
      fs.closeSync(fd);
    }
  });

  it('waits for the data when the descriptor has none yet', async () => {
    const fd = openReadFixture('later.bin', 'later');
    let calls = 0;
    fsMock.read.mockImplementation((...args: unknown[]) => {
      calls += 1;
      if (calls === 1) {
        const callback = args[args.length - 1] as (error: NodeJS.ErrnoException) => void;
        callback(osError('EAGAIN', 'resource temporarily unavailable'));
        return undefined;
      }
      return (realFs.read as (...inner: unknown[]) => unknown)(...args);
    });
    try {
      const input = createStdinInput(false, undefined, fd);
      const chunks: Buffer[] = [];
      input.on('data', (chunk: Buffer) => chunks.push(chunk));
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(calls).toBeGreaterThan(1);
      expect(Buffer.concat(chunks).toString()).toBe('later');
    } finally {
      fs.closeSync(fd);
    }
  });

  it('fails the stream when the descriptor reports a real error', async () => {
    const fd = openReadFixture('read-error.bin', 'x');
    fsMock.read.mockImplementation((...args: unknown[]) => {
      const callback = args[args.length - 1] as (error: NodeJS.ErrnoException) => void;
      callback(osError('EIO', 'input/output error'));
      return undefined;
    });
    try {
      const input = createStdinInput(false, undefined, fd);
      input.resume();
      await expect(new Promise((resolve, reject) => input.on('error', reject))).rejects.toThrow(/input\/output error/);
    } finally {
      fs.closeSync(fd);
    }
  });
});

describe('the standalone entry point bootstrap', () => {
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
