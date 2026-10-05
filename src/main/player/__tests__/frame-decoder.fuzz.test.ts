/**
 * @fileoverview Byte-level and dimension-level fuzz tests for `FrameDecoder` (Phase 2).
 *
 * `FrameDecoder` reassembles arbitrarily-chunked ffmpeg stdout into fixed-size
 * RGB24 frames, and does the same for S16LE PCM on fd 3. Both are pure byte
 * reassembly, so they can be fuzzed hard and fast with ffmpeg fully mocked.
 *
 * This found a **process-killing** bug. The stdout assembler drains with
 *
 *     while (framePartsLen >= frameSize) { ...; framePartsLen -= frameSize; }
 *
 * which only makes progress when `frameSize` is a positive integer. `open()`
 * computed `frameSize = width * height * 3` from caller-supplied dimensions with
 * no validation, so `frameSize === 0` made the condition permanently true and
 * the subtraction a no-op: **one byte of stdout** spun forever, pushing
 * zero-length buffers onto `pendingFrames` until V8 died of OOM and the Vitest
 * worker exited without a catchable error. A negative `frameSize` threw a
 * `RangeError` out of `Buffer.alloc` *inside* an EventEmitter handler, where
 * nothing can catch it, and `NaN` silently stalled assembly forever.
 *
 * The invariants that must hold for ANY byte stream and ANY dimensions:
 *  - frame assembly always terminates (never hangs, never throws);
 *  - every emitted frame is exactly `frameSize` bytes and matches the width and
 *    height reported alongside it;
 *  - the frame count is exactly `floor(totalBytesIn / frameSize)` - a byte
 *    ledger that drifts is how the fractional-dimension desync class works, and
 *    it is invisible to any test that only checks "some frame came out";
 *  - audio chunks are exactly the resolved target size;
 *  - heap usage does not grow without bound.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import fc from 'fast-check';
import type { DecodedFrame, DecodedAudio } from '../types';

const { spawnMock, existsSyncMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
  existsSyncMock: vi.fn(),
}));

vi.mock('child_process', () => ({
  spawn: spawnMock,
  ChildProcess: class {},
  default: { spawn: spawnMock },
}));
vi.mock('ffmpeg-static', () => ({ default: 'C:\\ffmpeg\\bin\\ffmpeg.exe' }));
vi.mock('fs', () => ({ existsSync: existsSyncMock, default: { existsSync: existsSyncMock } }));

const { FrameDecoder } = await import('../frame-decoder');
const { RGB_BYTES_PER_PIXEL, AUDIO_TARGET_MIN_BYTES } = await import('../../../shared/constants');
type Decoder = InstanceType<typeof FrameDecoder>;

type FakeProc = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdio: Array<null | EventEmitter>;
  kill: ReturnType<typeof vi.fn>;
};

function createFakeProcess(): FakeProc {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const audio = new EventEmitter();
  const proc = new EventEmitter() as FakeProc;
  proc.stdout = stdout;
  proc.stderr = stderr;
  proc.stdio = [null, stdout, stderr, audio];
  proc.kill = vi.fn();
  return proc;
}

/** Resolution used by most properties: 8x4 => 96-byte frames. */
const WIDTH = 8;
const HEIGHT = 4;
const FRAME_SIZE = WIDTH * HEIGHT * RGB_BYTES_PER_PIXEL;

/**
 * Opens a decoder at the given resolution and captures emitted frames/audio.
 *
 * Frames are only emitted once they can be paired with a PTS value, so this
 * also feeds one `pts_time` per frame; that keeps the fuzz focused on byte
 * reassembly rather than on the PTS matching heuristics.
 *
 * @returns {{decoder: Decoder, proc: FakeProc, frames: DecodedFrame[], audio: DecodedAudio[]}} The harness.
 */
function openDecoder(
  width: number = WIDTH,
  height: number = HEIGHT,
  audio?: { sampleRate: number; channels: number },
): { decoder: Decoder; proc: FakeProc; frames: DecodedFrame[]; audio: DecodedAudio[] } {
  const decoder = new FrameDecoder();
  decoder.open('in.mp4', width, height, audio);
  const proc = spawnMock.mock.results[spawnMock.mock.results.length - 1].value as FakeProc;
  const frames: DecodedFrame[] = [];
  const decodedAudio: DecodedAudio[] = [];
  decoder.on('frame', (f: DecodedFrame) => frames.push(f));
  decoder.on('audio', (a: DecodedAudio) => decodedAudio.push(a));
  return { decoder, proc, frames, audio: decodedAudio };
}

describe('FrameDecoder byte reassembly fuzz (Phase 2)', () => {
  beforeEach(() => {
    spawnMock.mockReset();
    spawnMock.mockImplementation(() => createFakeProcess());
    existsSyncMock.mockReset();
    existsSyncMock.mockReturnValue(true);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('stdout / rawvideo frame assembly', () => {
    it('assembles exactly floor(totalBytes / frameSize) frames from arbitrary chunk boundaries', () => {
      fc.assert(
        fc.property(fc.array(fc.integer({ min: 0, max: 300 }), { maxLength: 24 }), (chunkSizes) => {
          const { proc, frames } = openDecoder();

          // PTS is fed *before* the data and never in short supply. The decoder
          // has a deliberate 200 ms emergency flush that emits a frame with an
          // *estimated* PTS when showinfo lags, so the emitted frame count is
          // otherwise a function of wall-clock timing rather than of the byte
          // stream - a GC pause alone would make it nondeterministic. Keeping a
          // PTS surplus pins the count to the byte ledger deterministically.
          let pts = 0;
          const feedPts = (count: number): void => {
            let text = '';
            for (let i = 0; i < count; i++) text += `[Parsed_showinfo] pts_time:${pts++}\n`;
            proc.stderr.emit('data', Buffer.from(text));
          };
          /** Worst case is a 300-byte chunk, which is at most 4 frames. */
          const PTS_PER_CHUNK = 4;

          let total = 0;
          let threw: unknown;
          try {
            for (const size of chunkSizes) {
              feedPts(PTS_PER_CHUNK);
              proc.stdout.emit('data', Buffer.alloc(size, size & 0xff));
              total += size;
            }
          } catch (err) {
            threw = err;
          }

          const label = `chunks=[${chunkSizes.join(',')}] total=${total} frameSize=${FRAME_SIZE}`;
          if (threw) throw new Error(`${label}: handler threw ${String(threw)}`);

          // Every emitted frame is exactly one frame long and self-consistent.
          for (const frame of frames) {
            if (frame.buffer.length !== FRAME_SIZE) {
              throw new Error(`${label}: frame length ${frame.buffer.length} != ${FRAME_SIZE}`);
            }
            if (frame.buffer.length !== frame.width * frame.height * RGB_BYTES_PER_PIXEL) {
              throw new Error(`${label}: frame ${frame.width}x${frame.height} carries ${frame.buffer.length} bytes`);
            }
            if (!Number.isFinite(frame.pts)) throw new Error(`${label}: pts=${String(frame.pts)}`);
          }

          // The byte ledger. Emitted bytes can never exceed what arrived, and
          // the frame count must be exactly floor(total / frameSize) - anything
          // else means the ledger drifted. This is what catches the
          // fractional-frameSize desync, which no "a frame came out" test sees.
          const expectedFrames = Math.floor(total / FRAME_SIZE);
          if (frames.length !== expectedFrames) {
            throw new Error(`${label}: emitted ${frames.length} frames, ledger implies ${expectedFrames}`);
          }
        }),
        { numRuns: 400 },
      );
    });

    it('preserves byte order across chunk splits', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 4000 }), (size) => {
          const { proc, frames } = openDecoder();
          const payload = Buffer.alloc(size);
          for (let i = 0; i < size; i++) payload[i] = i & 0xff;

          let pts = 0;
          const feedPts = (count: number): void => {
            let text = '';
            for (let i = 0; i < count; i++) text += `[Parsed_showinfo] pts_time:${pts++}\n`;
            proc.stderr.emit('data', Buffer.from(text));
          };

          // One byte at a time for small payloads, otherwise in irregular slices.
          const step = size > 64 ? Math.max(1, Math.floor(size / 17)) : 1;
          const perChunk = Math.ceil(step / FRAME_SIZE) + 1;
          for (let off = 0; off < size; off += step) {
            feedPts(perChunk);
            proc.stdout.emit('data', payload.subarray(off, Math.min(off + step, size)));
          }

          const expected = Math.floor(size / FRAME_SIZE);
          if (frames.length !== expected) {
            throw new Error(`size=${size}: emitted ${frames.length} frames, expected ${expected}`);
          }
          for (let f = 0; f < frames.length; f++) {
            const actual = frames[f].buffer;
            const base = f * FRAME_SIZE;
            for (let i = 0; i < FRAME_SIZE; i++) {
              if (actual[i] !== payload[base + i]) {
                throw new Error(`size=${size} frame=${f} byte=${i}: ${actual[i]} != ${payload[base + i]}`);
              }
            }
          }
        }),
        { numRuns: 200 },
      );
    });

    it.each([
      ['zero bytes', 0],
      ['one byte', 1],
      ['one byte short of a frame', FRAME_SIZE - 1],
      ['exactly one frame', FRAME_SIZE],
      ['one byte over a frame', FRAME_SIZE + 1],
      ['odd length', FRAME_SIZE * 3 + 7],
      ['not a multiple of bytes-per-pixel', FRAME_SIZE * 2 + 1],
      ['many frames', FRAME_SIZE * 40],
    ])('handles %s without throwing or stalling', (_label, size) => {
      const { proc, frames } = openDecoder();
      let threw: unknown;
      try {
        // A PTS surplus keeps the 200 ms emergency flush from firing, so the
        // expected count is a pure function of the byte count.
        let text = '';
        for (let i = 0; i <= Math.floor(size / FRAME_SIZE) + 1; i++) text += `[Parsed_showinfo] pts_time:${i}\n`;
        proc.stderr.emit('data', Buffer.from(text));
        proc.stdout.emit('data', Buffer.alloc(size, 0xab));
      } catch (err) {
        threw = err;
      }
      expect(threw).toBeUndefined();
      expect(frames.length).toBe(Math.floor(size / FRAME_SIZE));
      for (const frame of frames) expect(frame.buffer.length).toBe(FRAME_SIZE);
    });

    it('never grows the heap without bound across a large stream', () => {
      const { decoder, proc } = openDecoder();
      // Seed so the first measurement is not dominated by lazy imports.
      proc.stdout.emit('data', Buffer.alloc(FRAME_SIZE * 500));
      globalThis.gc?.();
      const before = process.memoryUsage().heapUsed;

      let ptsCount = 0;
      for (let i = 0; i < 4000; i++) {
        proc.stdout.emit('data', Buffer.alloc(FRAME_SIZE, i & 0xff));
        proc.stderr.emit('data', Buffer.from(`[Parsed_showinfo] pts_time:${ptsCount}\n`));
        ptsCount++;
      }
      globalThis.gc?.();
      const growth = process.memoryUsage().heapUsed - before;

      // 4000 frames x 96 bytes is 384 KB of payload; anything near that is
      // expected. The bug allocated unboundedly, so this ceiling is generous
      // while still failing a runaway.
      expect(growth).toBeLessThan(64 * 1024 * 1024);
      decoder.close();
    });
  });

  describe('hostile dimensions', () => {
    // Every one of these used to hang the worker (0), throw out of an
    // EventEmitter handler (negative), or silently stall assembly (NaN/Infinity).
    const hostile: Array<[string, number, number]> = [
      ['zero width and height', 0, 0],
      ['zero width only', 0, HEIGHT],
      ['zero height only', WIDTH, 0],
      ['negative width', -1, HEIGHT],
      ['negative height', WIDTH, -1],
      ['both negative', -8, -4],
      ['NaN width', Number.NaN, HEIGHT],
      ['NaN height', WIDTH, Number.NaN],
      ['Infinity width', Number.POSITIVE_INFINITY, HEIGHT],
      ['Infinity height', WIDTH, Number.POSITIVE_INFINITY],
      ['fractional width', 2.5, 2.5],
      ['huge dimensions', 100000, 100000],
    ];

    it.each(hostile)('terminates on %s without throwing', (_label, width, height) => {
      const { proc, frames } = openDecoder(width, height);
      let threw: unknown;
      try {
        proc.stdout.emit('data', Buffer.alloc(4096, 1));
        proc.stdout.emit('data', Buffer.from([1]));
      } catch (err) {
        threw = err;
      }
      expect(threw).toBeUndefined();

      // Whatever survived clamping must still be internally consistent.
      for (const frame of frames) {
        expect(frame.width).toBeGreaterThanOrEqual(1);
        expect(frame.height).toBeGreaterThanOrEqual(1);
        expect(frame.buffer.length).toBe(frame.width * frame.height * RGB_BYTES_PER_PIXEL);
      }
    });

    // "Does not throw" is vacuous for a decoder that stalls instead: a NaN or
    // Infinity frameSize makes `framePartsLen >= frameSize` false forever, so
    // zero frames are emitted and there is no error to catch. Requiring actual
    // assembly is what makes those cases fail instead of passing silently.
    //
    // `huge dimensions` is deliberately excluded: a 100000x100000 request is a
    // legitimate 30 GB frame, not a hostile one, so 4096 bytes correctly yields
    // no frame. Clamping it to a maximum would reject valid 4K decodes.
    const clamped = hostile.filter(([label]) => label !== 'huge dimensions');

    it.each(clamped)('still assembles frames from %s rather than stalling', (_label, width, height) => {
      const { proc, frames } = openDecoder(width, height);
      let pts = '';
      for (let i = 0; i <= 4096; i++) pts += `[Parsed_showinfo] pts_time:${i}\n`;
      proc.stderr.emit('data', Buffer.from(pts));
      proc.stdout.emit('data', Buffer.alloc(4096, 2));

      expect(frames.length).toBeGreaterThan(0);
      // The clamped frame size must divide the input cleanly: no orphan bytes.
      const consumed = frames.length * frames[0].buffer.length;
      expect(consumed).toBeLessThanOrEqual(4096);
      expect(4096 - consumed).toBeLessThan(frames[0].buffer.length);
    });

    it('honors a large but legitimate resolution instead of clamping it', () => {
      const { proc, frames } = openDecoder(3840, 2160);
      // A 4K RGB24 frame is 24,883,200 bytes; 4096 bytes must not assemble one.
      proc.stderr.emit('data', Buffer.from('[Parsed_showinfo] pts_time:0\n'));
      proc.stdout.emit('data', Buffer.alloc(4096, 2));
      expect(frames).toHaveLength(0);
    });

    it('clamps a zero resolution to a single pixel instead of a zero-byte frame', () => {
      const { proc, frames } = openDecoder(0, 0);
      proc.stdout.emit('data', Buffer.alloc(9, 3));
      proc.stderr.emit('data', Buffer.from('[Parsed_showinfo] pts_time:0\n'));
      proc.stderr.emit('data', Buffer.from('[Parsed_showinfo] pts_time:1\n'));
      proc.stderr.emit('data', Buffer.from('[Parsed_showinfo] pts_time:2\n'));
      // 9 bytes at 3 bytes per pixel is exactly 3 frames, not an infinite spin.
      expect(frames.length).toBe(3);
      for (const frame of frames) expect(frame.buffer.length).toBe(3);
    });

    it('asks ffmpeg for the same resolution it assembles', () => {
      openDecoder(0, 0);
      const args = (spawnMock.mock.calls[0] as unknown as [string, string[]])[1];
      const sizeFlag = args.indexOf('-s');
      expect(args[sizeFlag + 1]).toBe('1x1');
    });
  });

  describe('fd 3 / PCM audio assembly', () => {
    it('emits only whole chunks and never more bytes than arrived', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 700 }), { maxLength: 20 }),
          fc.integer({ min: 8000, max: 48000 }),
          fc.integer({ min: 1, max: 8 }),
          (chunkSizes, sampleRate, channels) => {
            const target = Math.max(AUDIO_TARGET_MIN_BYTES, Math.round(sampleRate * channels * 2 * 0.05));
            const { proc, audio } = openDecoder(WIDTH, HEIGHT, { sampleRate, channels });

            let total = 0;
            let threw: unknown;
            try {
              for (const size of chunkSizes) {
                proc.stdio[3]?.emit('data', Buffer.alloc(size));
                total += size;
              }
            } catch (err) {
              threw = err;
            }
            if (threw) throw new Error(`chunks=[${chunkSizes.join(',')}] threw ${String(threw)}`);

            const label = `chunks=[${chunkSizes.join(',')}] total=${total} target=${target}`;
            if (audio.length !== Math.floor(total / target)) {
              throw new Error(`${label}: emitted ${audio.length} chunks, expected ${Math.floor(total / target)}`);
            }
            for (const chunk of audio) {
              if (chunk.buffer.length !== target) throw new Error(`${label}: chunk length ${chunk.buffer.length}`);
              expect(chunk.sampleRate).toBe(sampleRate);
              expect(chunk.channels).toBe(channels);
            }
          },
        ),
        { numRuns: 300 },
      );
    });

    it.each([
      ['NaN sample rate', Number.NaN, 2],
      ['Infinity sample rate', Number.POSITIVE_INFINITY, 2],
      ['NaN channels', 44100, Number.NaN],
      ['zero channels', 44100, 0],
      ['negative sample rate', -44100, 2],
      ['both non-finite', Number.NaN, Number.NaN],
    ])('falls back to the minimum chunk size for %s', (_label, sampleRate, channels) => {
      const { proc, audio } = openDecoder(WIDTH, HEIGHT, { sampleRate, channels });
      let threw: unknown;
      try {
        proc.stdio[3]?.emit('data', Buffer.alloc(AUDIO_TARGET_MIN_BYTES * 3));
        proc.stdio[3]?.emit('data', Buffer.alloc(7));
      } catch (err) {
        threw = err;
      }
      expect(threw).toBeUndefined();
      // A non-finite config must not silently disable assembly altogether.
      expect(audio.length).toBe(3);
      for (const chunk of audio) expect(chunk.buffer.length).toBe(AUDIO_TARGET_MIN_BYTES);
    });
  });

  describe('stderr / showinfo fuzzing', () => {
    it('survives arbitrary stderr text without throwing or emitting non-finite pts', () => {
      fc.assert(
        fc.property(fc.string(), (text) => {
          const { proc, frames } = openDecoder();
          let ptsCount = 0;
          let threw: unknown;
          try {
            for (let off = 0; off < text.length; off += 7) {
              proc.stdout.emit('data', Buffer.alloc(FRAME_SIZE, off & 0xff));
              proc.stderr.emit('data', Buffer.from(text.slice(off, off + 7)));
              ptsCount++;
            }
          } catch (err) {
            threw = err;
          }
          if (threw) throw new Error(`stderr=${JSON.stringify(text)} threw ${String(threw)}`);
          for (const frame of frames) {
            if (!Number.isFinite(frame.pts)) throw new Error(`stderr=${JSON.stringify(text)}: pts=${String(frame.pts)}`);
          }
          expect(ptsCount).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 300 },
      );
    });

    it('ignores pts_time tokens that are not finite numbers', () => {
      const { proc, frames } = openDecoder();
      proc.stderr.emit('data', Buffer.from('[Parsed_showinfo] pts_time:1\n'));
      proc.stdout.emit('data', Buffer.alloc(FRAME_SIZE, 9));
      proc.stderr.emit('data', Buffer.from('[Parsed_showinfo] pts_time:\n'));
      proc.stderr.emit('data', Buffer.from('[Parsed_showinfo] pts_time:   \n'));
      proc.stderr.emit('data', Buffer.from('[Parsed_showinfo] pts_time:2.5\n'));
      proc.stdout.emit('data', Buffer.alloc(FRAME_SIZE, 8));
      expect(frames.map((f) => f.pts)).toEqual([1, 2.5]);
    });
  });
});
