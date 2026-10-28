/**
 * @fileoverview Integration coverage for the stdin stream shim.
 */

import { describe, it, expect } from 'vitest';
import { PassThrough } from 'stream';
import { createStdinInput } from '../stdin';

describe('createStdinInput (integration)', () => {
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
});
