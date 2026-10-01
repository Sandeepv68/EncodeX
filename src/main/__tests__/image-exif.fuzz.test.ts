import { describe, expect, it, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import fc from 'fast-check';

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock('child_process', () => ({
  spawn: spawnMock,
  ChildProcess: class {},
  default: { spawn: spawnMock },
}));

vi.mock('ffmpeg-static', () => ({ default: 'C:\\ffmpeg\\bin\\ffmpeg.exe' }));

const { flattenExif, getImageInfo } = await import('../image-info');
const { HISTOGRAM_MAX_WIDTH, RGB_BYTES_PER_PIXEL } = await import('../../shared/constants');

/**
 * Generous ceiling for a single EXIF read. exifr handles every bomb below in
 * single-digit milliseconds; this only exists to turn a regression-level hang
 * into a test failure instead of a stuck suite.
 */
const BOMB_BUDGET_MS = 10_000;

/** Options the app passes to exifr; duplicated so drift is caught here. */
const APP_EXIF_OPTIONS = { skipUnknown: true, reviveValues: false };

let workDir: string;
let seq = 0;

/** Writes `buf` to a temp file and returns its path. */
function onDisk(buf: Buffer, ext = 'tif'): string {
  const p = join(workDir, `bomb-${seq++}.${ext}`);
  writeFileSync(p, buf);
  return p;
}

type Entry = { tag: number; type: number; count: number; value: number };

/**
 * Builds a little-endian TIFF from raw IFD entries. Overrides let a caller
 * corrupt the structural fields independently of the entries themselves.
 */
function tiff(entries: Entry[], overrides: { ifdOffset?: number; entryCount?: number; nextIfd?: number } = {}): Buffer {
  const ENTRY_SIZE = 12;
  const ifdStart = 8;
  const count = overrides.entryCount ?? entries.length;
  const buf = Buffer.alloc(ifdStart + 2 + count * ENTRY_SIZE + 4);
  buf.write('II', 0, 'ascii');
  buf.writeUInt16LE(0x2a, 2);
  buf.writeUInt32LE(overrides.ifdOffset ?? ifdStart, 4);
  buf.writeUInt16LE(count & 0xffff, ifdStart);
  entries.forEach((e, i) => {
    const off = ifdStart + 2 + i * ENTRY_SIZE;
    buf.writeUInt16LE(e.tag, off);
    buf.writeUInt16LE(e.type, off + 2);
    buf.writeUInt32LE(e.count >>> 0, off + 4);
    buf.writeUInt32LE(e.value >>> 0, off + 8);
  });
  buf.writeUInt32LE(overrides.nextIfd ?? 0, ifdStart + 2 + count * ENTRY_SIZE);
  return buf;
}

/** Builds a TIFF whose ASCII tag values live out-of-line, as real files do. */
function tiffWithAscii(strings: Array<{ tag: number; text: string }>, nextIfd = 0): Buffer {
  const ENTRY_SIZE = 12;
  const count = strings.length;
  const ifdStart = 8;
  const dataStart = ifdStart + 2 + count * ENTRY_SIZE + 4;
  const chunks: Buffer[] = [];
  let dataLen = 0;
  const meta = strings.map((s) => {
    const bytes = Buffer.concat([Buffer.from(s.text, 'latin1'), Buffer.from([0])]);
    const info = { count: bytes.length, offset: dataStart + dataLen, inline: bytes.length <= 4 };
    chunks.push(bytes);
    dataLen += bytes.length;
    return info;
  });
  const header = Buffer.alloc(8);
  header.write('II', 0, 'ascii');
  header.writeUInt16LE(0x2a, 2);
  header.writeUInt32LE(ifdStart, 4);
  const ifd = Buffer.alloc(2 + count * ENTRY_SIZE + 4);
  ifd.writeUInt16LE(count, 0);
  meta.forEach((m, i) => {
    const off = 2 + i * ENTRY_SIZE;
    ifd.writeUInt16LE(strings[i].tag, off);
    ifd.writeUInt16LE(2, off + 2);
    ifd.writeUInt32LE(m.count, off + 4);
    if (m.inline) ifd.write(strings[i].text.slice(0, 4).padEnd(4, '\0'), off + 8, 'latin1');
    else ifd.writeUInt32LE(m.offset, off + 8);
  });
  ifd.writeUInt32LE(nextIfd, 2 + count * ENTRY_SIZE);
  return Buffer.concat([header, ifd, ...chunks]);
}

/** Wraps a TIFF payload in a JPEG APP1/Exif segment. */
function jpegWithExif(tiffPayload: Buffer): Buffer {
  const app1 = Buffer.alloc(4);
  app1.writeUInt16BE(0xffe1, 0);
  app1.writeUInt16BE(2 + 6 + tiffPayload.length, 2);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, Buffer.from('Exif\0\0', 'latin1'), tiffPayload, Buffer.from([0xff, 0xd9])]);
}

/** Builds a fake child whose ffmpeg run fails, so histograms come back null. */
function fakeFfmpegFailure(): EventEmitter {
  const proc = new EventEmitter() as EventEmitter & Record<string, unknown>;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdio = [null, proc.stdout, proc.stderr, null];
  proc.pid = 4242;
  proc.kill = vi.fn();
  setImmediate(() => {
    (proc.stderr as EventEmitter).emit('data', Buffer.from('Invalid data found when processing input'));
    proc.emit('close', 1);
  });
  return proc;
}

/** Builds a fake child that yields solid RGB rows, so histograms come back. */
function fakeFfmpegSuccess(): EventEmitter {
  const proc = new EventEmitter() as EventEmitter & Record<string, unknown>;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.stdio = [null, proc.stdout, proc.stderr, null];
  proc.pid = 4243;
  proc.kill = vi.fn();
  setImmediate(() => {
    (proc.stdout as EventEmitter).emit('data', Buffer.alloc(HISTOGRAM_MAX_WIDTH * 2 * RGB_BYTES_PER_PIXEL, 0x40));
    proc.emit('close', 0);
  });
  return proc;
}

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), 'image-exif-fuzz-'));
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

beforeEach(() => {
  spawnMock.mockReset();
  spawnMock.mockImplementation(() => fakeFfmpegFailure());
});

/** Runs `getImageInfo` under a time ceiling so a hang fails the test. */
async function withinBudget<T>(label: string, run: () => Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`getImageInfo did not settle within ${BOMB_BUDGET_MS}ms: ${label}`)), BOMB_BUDGET_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

describe('image EXIF: hand-built TIFF bombs against the real parser', () => {
  /**
   * Non-vacuity guard. Every bomb assertion below is about what the app does
   * with a file that failed to parse, so the suite is worthless unless these
   * hand-built bytes genuinely produce EXIF when well formed.
   */
  it('reads real tags from a hand-built TIFF and from a JPEG wrapping one', async () => {
    const tiffPath = onDisk(
      tiffWithAscii([
        { tag: 0x010f, text: 'ACME' },
        { tag: 0x0110, text: 'Cam9000' },
      ]),
    );
    const jpegPath = onDisk(
      jpegWithExif(
        tiffWithAscii([
          { tag: 0x010f, text: 'ACME' },
          { tag: 0x0110, text: 'Cam9000' },
        ]),
      ),
      'jpg',
    );

    for (const path of [tiffPath, jpegPath]) {
      const info = await withinBudget(path, () => getImageInfo(path));
      expect(info, `${path} should yield metadata`).not.toBeNull();
      expect(info?.exif.Make).toBe('ACME');
      expect(info?.exif.Model).toBe('Cam9000');
    }
    expect(Object.keys((await getImageInfo(tiffPath))?.exif ?? {})).not.toContain('errors');
  });

  it('reads resolution tags whose values are the maximum 32-bit integer', async () => {
    const path = onDisk(
      tiff([
        { tag: 0x011a, type: 4, count: 1, value: 0xffffffff },
        { tag: 0x011b, type: 4, count: 1, value: 0xffffffff },
      ]),
    );
    const info = await withinBudget(path, () => getImageInfo(path));
    expect(info?.exif.XResolution).toBe('4294967295');
    expect(info?.exif.YResolution).toBe('4294967295');
  });

  /**
   * Not every alarming-looking value is a parse failure. A strip byte count of
   * 0xFFFFFFFF is a well-formed LONG tag, so it must surface as metadata
   * rather than being swallowed alongside genuinely corrupt files.
   */
  it('treats a strip byte count of 0xFFFFFFFF as a real tag, not a failure', async () => {
    const path = onDisk(tiff([{ tag: 0x0117, type: 4, count: 1, value: 0xffffffff }]));
    const info = await withinBudget(path, () => getImageInfo(path));
    expect(info?.exif.StripByteCounts).toBe('4294967295');
    expect(Object.keys(info?.exif ?? {})).not.toContain('errors');
  });

  /**
   * These files declare structures that cannot exist. exifr recovers by adding
   * an `errors` array to its result instead of throwing, so the failure mode
   * under test is a garbage file being reported as having metadata, with the
   * internal parser message surfaced as if it were a tag.
   */
  it.each([
    ['IFD offset outside the buffer', tiff([{ tag: 0x010f, type: 2, count: 5, value: 8 }], { ifdOffset: 0x7fffffff })],
    ['IFD entry count of 65535', tiff([{ tag: 0x010f, type: 2, count: 5, value: 8 }], { entryCount: 0xffff })],
    ['IFD entry count reading as a negative int16', tiff([{ tag: 0x010f, type: 2, count: 5, value: 8 }], { entryCount: 0x8001 })],
    ['bare header with no IFD', Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00])],
    ['Photoshop IRB declaring a 4 GB length', tiff([{ tag: 0x8649, type: 7, count: 0xfffffff0, value: 0 }])],
    ['entry table truncated mid-entry', tiffWithAscii([{ tag: 0x010f, text: 'ACME' }]).subarray(0, 14)],
    [
      'byte-order marker contradicting the body',
      (() => {
        const b = tiffWithAscii([{ tag: 0x010f, text: 'ACME' }]);
        b.write('MM', 0, 'ascii');
        return b;
      })(),
    ],
    ['64 KB of zero bytes', Buffer.alloc(65536)],
  ])('reports no metadata for a file with %s', async (_label, buf) => {
    const path = onDisk(buf);
    const info = await withinBudget(_label, () => getImageInfo(path));

    // ffmpeg was faked to fail, so there is no histogram to fall back on.
    expect(info).toBeNull();
  });

  it('keeps a self-referential IFDNext chain from looping or duplicating tags', async () => {
    const path = onDisk(tiffWithAscii([{ tag: 0x010f, text: 'ACME' }], 8));
    const info = await withinBudget('self-referential IFDNext', () => getImageInfo(path));
    expect(info?.exif.Make).toBe('ACME');
    expect(Object.keys(info?.exif ?? {}).filter((k) => k === 'Make')).toHaveLength(1);
  });

  it('drops the errors key even when a frame decodes successfully', async () => {
    spawnMock.mockImplementation(() => fakeFfmpegSuccess());
    const path = onDisk(tiff([{ tag: 0x010f, type: 2, count: 5, value: 8 }], { ifdOffset: 0x7fffffff }));
    const info = await withinBudget('errors key with histogram', () => getImageInfo(path));

    expect(info).not.toBeNull();
    expect(info?.histogram).not.toBeNull();
    expect(info?.exif).toEqual({});
    expect(Object.keys(info?.exif ?? {})).not.toContain('errors');
  });
});

/**
 * A linear chain `depth` nodes long, each carrying a scalar alongside its
 * `next` pointer so that every level contributes an observable key.
 *
 * `depth` is deliberately 1,000: above the 32-level depth cap, but below the
 * 1,024-node budget. That combination isolates the depth cap, since a chain
 * long enough to overflow the stack would be cut short by the budget first and
 * the cap could never be observed to matter.
 */
function linearChain(depth: number): Record<string, unknown> {
  let node: Record<string, unknown> = { leaf: 'bottom' };
  for (let i = depth - 1; i >= 0; i--) node = { [`k${i}`]: `v${i}`, next: node };
  return node;
}

/**
 * Every node holds two keys pointing at the same child, so the walk sees
 * 2^depth distinct paths while never getting deep. Depth alone cannot stop
 * this; only a budget on total nodes can. The depth is kept small enough that
 * the unbounded version still terminates, turning a regression into a failed
 * assertion rather than a hung worker.
 */
function branchingTree(depth: number): Record<string, unknown> {
  let node: Record<string, unknown> = { leaf: 'bottom' };
  for (let i = 0; i < depth; i++) {
    const child = node;
    node = { tag: `n${i}`, a: child, b: child };
  }
  return node;
}

describe('flattenExif: hostile structures', () => {
  it('stops at the depth cap on a deeply nested chain', () => {
    const flat = flattenExif(linearChain(1_000));
    // The outermost levels are flattened; the bottom of the chain is not.
    expect(flat['k0']).toBe('v0');
    expect(flat['next.k1']).toBe('v1');
    expect(flat.leaf).toBeUndefined();
    expect(Object.keys(flat).length).toBeLessThanOrEqual(64);
  });

  it('bounds total work when every node reaches the same subtree twice', () => {
    const flat = flattenExif(branchingTree(14));
    expect(flat.tag).toBe('n13');
    expect(flat['a.tag']).toBe('n12');
    // Shallow paths survive; the exponential tail does not.
    expect(Object.keys(flat).length).toBeLessThan(8_192);
  });

  it('flattens a subtree reachable from two branches', () => {
    const shared = { Model: 'Cam9000' };
    const flat = flattenExif({ a: shared, b: shared });
    expect(flat['a.Model']).toBe('Cam9000');
    expect(flat['b.Model']).toBe('Cam9000');
  });

  it('honours an explicit prefix and skips null values', () => {
    expect(flattenExif({ GPS: { Latitude: 1, Longitude: null } }, 'IFD0')).toEqual({ 'IFD0.GPS.Latitude': '1' });
  });

  it('returns an empty map for non-object input', () => {
    expect(flattenExif(null)).toEqual({});
    expect(flattenExif(undefined)).toEqual({});
    expect(flattenExif(42)).toEqual({});
    expect(flattenExif('text')).toEqual({});
  });

  it('never throws and always yields string values for arbitrary structures', () => {
    const leaf = fc.oneof(
      fc.string({ maxLength: 8 }),
      fc.integer(),
      fc.constantFrom(true, false, null, undefined, 0, -0, NaN, Infinity, -Infinity),
      fc.bigInt(),
      fc.array(fc.integer(), { maxLength: 4 }),
    );
    const structure = fc.letrec((tie) => ({
      node: fc.oneof(leaf, fc.dictionary(fc.string({ maxLength: 4 }), tie('node'), { maxKeys: 3 })),
    })).node;

    fc.assert(
      fc.property(structure, (input) => {
        let flat: Record<string, string> = {};
        expect(() => {
          flat = flattenExif(input);
        }).not.toThrow();
        for (const [k, v] of Object.entries(flat)) {
          expect(typeof k).toBe('string');
          expect(typeof v, `value for ${k}`).toBe('string');
        }
      }),
      { numRuns: 200 },
    );
  });
});
