/**
 * @fileoverview Runs every corrupt-media file in the generated corpus through
 * the real main-process media paths and asserts they degrade cleanly.
 *
 * This is the `test:media-fuzz` tier (see `vitest.media-fuzz.config.ts`). It
 * spawns the real `ffmpeg-static` / `ffprobe-static` binaries, so it is far
 * slower than the unit suite and is deliberately excluded from it. Nothing is
 * mocked here: the point is to find what real decoders do to real garbage.
 *
 * The corpus is regenerated per run by `src/test-utils/media-corpus.ts`, and is
 * deterministic given `MEDIA_FUZZ_SEED`, so a failure is replayable.
 *
 * Invariants asserted for every corpus file:
 *  - the call settles within a wall-clock budget (a hang fails the run)
 *  - it resolves to a structurally sane value, `null`, or rejects
 *  - a rejection is never a `TypeError`/`RangeError`, which would mean our own
 *    code broke rather than the decoder refusing the file
 *  - no `NaN` or `Infinity` ever reaches the result
 *
 * Pristine seeds are asserted to still succeed. Without that control a suite
 * proving only "nothing ever throws" would pass just as happily against a
 * build where every path returns `null`.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildCorpus, corpusSeedFromEnv, createSeeds, type CorpusFile } from '../../test-utils/media-corpus';
import { isAppError } from '../../shared/errors';
import { getVideoPreview } from '../video-preview';
import { getImagePreview } from '../image-preview';
import { getImageFileInfo } from '../image-file-info';
import { getImageInfo } from '../image-info';
import { extractWaveform, extractThumbnails } from '../timeline/timeline-media';
import { FFToolCore } from '../transcoders/fftool-core';

/** Wall-clock ceiling for a single call. Generous: these are real processes. */
const CALL_BUDGET_MS = 20_000;

/** Rejections that indicate our own defect rather than a decoder refusal. */
const BUGGY_REJECTIONS = new Set(['TypeError', 'RangeError', 'ReferenceError', 'SyntaxError']);

/**
 * Caps on the two most expensive paths. Video preview costs up to two ffmpeg
 * spawns per file, and the timeline extractors fan out into several segments
 * each, so both run on a bounded slice of the corpus by default.
 */
const VIDEO_PREVIEW_LIMIT = Number.parseInt(process.env.MEDIA_FUZZ_VIDEO_PREVIEW_LIMIT ?? '30', 10);
const TIMELINE_LIMIT = Number.parseInt(process.env.MEDIA_FUZZ_TIMELINE_LIMIT ?? '16', 10);

/** The duration the timeline extractors are asked to cover, matching `seed-av.mp4`. */
const TIMELINE_DURATION = 3;

/** Seed used for the timeline control checks: the one with an audio stream. */
const TIMELINE_SEED = 'seed-av.mp4';

let workDir: string;
let corpus: CorpusFile[];

/** Resolves with the value, or with a marker describing how it settled. */
type Settled = { ok: true; value: unknown } | { ok: false; error: { name: string; message: string; isApp: boolean } };

/**
 * Races a call against a wall-clock budget.
 *
 * A synchronous runaway inside the code under test would block the event loop
 * and defeat the timer, so this can only catch hangs that leave the loop free;
 * that is still the common shape for a wedged decoder, and the process-level
 * `--testTimeout` covers the rest.
 */
async function settle(promise: Promise<unknown>): Promise<Settled> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise.then(
        (value) => ({ ok: true, value }) as Settled,
        (error: unknown) =>
          ({
            ok: false,
            error: {
              name: error instanceof Error ? error.name : typeof error,
              message: error instanceof Error ? error.message : String(error),
              isApp: isAppError(error),
            },
          }) as Settled,
      ),
      new Promise<Settled>((resolve) => {
        timer = setTimeout(
          () => resolve({ ok: false, error: { name: 'BudgetExceeded', message: `exceeded ${CALL_BUDGET_MS}ms`, isApp: false } }),
          CALL_BUDGET_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Fails with a useful label when a call hung or broke in our own code. */
function expectClean(result: Settled, label: string): void {
  if (result.ok) return;
  expect(result.error.name, `${label} hung: ${result.error.message}`).not.toBe('BudgetExceeded');
  expect(BUGGY_REJECTIONS.has(result.error.name), `${label} rejected with ${result.error.name}: ${result.error.message}`).toBe(false);
}

/**
 * Outcome tally, printed when `MEDIA_FUZZ_VERBOSE` is set.
 *
 * Worth keeping: a sweep that reports "everything returned null" can equally
 * mean the corpus was rejected at the extension check before any process was
 * ever spawned, which would make the whole tier vacuous. The counts show how
 * much work actually reached the decoders.
 */
const tally = new Map<string, { value: number; nullish: number; rejected: number }>();

function record(path: string, result: Settled): void {
  if (!process.env.MEDIA_FUZZ_VERBOSE) return;
  const row = tally.get(path) ?? { value: 0, nullish: 0, rejected: 0 };
  if (!result.ok) row.rejected += 1;
  else if (result.value === null || result.value === undefined) row.nullish += 1;
  else row.value += 1;
  tally.set(path, row);
}

function printTally(): void {
  if (!process.env.MEDIA_FUZZ_VERBOSE) return;
  for (const [name, row] of [...tally].sort()) {
    // stderr rather than console.info: the suite's console is stubbed by the
    // crash tripwire, so console output would never be visible.
    process.stderr.write(`[media-fuzz] ${name}: value=${row.value} null=${row.nullish} rejected=${row.rejected}\n`);
  }
}

/** Recursively asserts no number in a result is `NaN` or non-finite. */
function expectNoBadNumbers(value: unknown, label: string, seen = new Set<unknown>()): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value), `${label} produced ${value}`).toBe(true);
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Buffer.isBuffer(value) || ArrayBuffer.isView(value)) return;
  if (Array.isArray(value)) {
    for (const item of value) expectNoBadNumbers(item, label, seen);
    return;
  }
  for (const [k, v] of Object.entries(value)) {
    // Skip byte payloads, which are legitimately large but never numbers.
    if (k === 'data' || k === 'dataUrl' || k === 'buffer') continue;
    expectNoBadNumbers(v, `${label}.${k}`, seen);
  }
}

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), 'encodex-media-fuzz-'));
  corpus = buildCorpus(workDir, createSeeds(workDir), corpusSeedFromEnv());
  // Nothing in the suite depends on the exact count, but an empty or
  // single-file corpus would make every assertion vacuous.
  expect(corpus.length).toBeGreaterThan(50);
}, 300_000);

afterAll(() => {
  printTally();
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

const transcoder = new FFToolCore();

/**
 * Selects from the corpus. Called inside test bodies rather than in `describe`
 * blocks, because the corpus is built in `beforeAll` and `describe` callbacks
 * run during collection, before any hook has executed.
 */
function select(predicate: (file: CorpusFile) => boolean): CorpusFile[] {
  return corpus.filter(predicate);
}

const pristine = (): CorpusFile[] => select((f) => f.kind === 'pristine');
const corrupt = (): CorpusFile[] => select((f) => f.kind !== 'pristine');

/**
 * Picks a spread of files across seeds *and* corruption kinds, not a prefix.
 *
 * The corpus is generated seed by seed, so the first N video entries are all
 * the near-empty truncations of `seed.mp4`. A prefix slice therefore spends its
 * whole budget on 0- and 1-byte files and never reaches the bit-flipped or
 * mismatched ones — which are the cases most likely to slip past a decoder's
 * header checks. Bucketing per (seed, kind) and round-robining keeps every
 * class of every seed represented, so `seed-av.mp4` is actually reached.
 */
function stratified(candidates: CorpusFile[], total: number): CorpusFile[] {
  const bySeedKind = new Map<string, CorpusFile[]>();
  for (const file of candidates) {
    const key = `${file.seedName ?? file.name}\x00${file.kind}`;
    const bucket = bySeedKind.get(key) ?? [];
    bucket.push(file);
    bySeedKind.set(key, bucket);
  }
  const queues = [...bySeedKind.values()];
  const out: CorpusFile[] = [];
  let progressed = true;
  while (out.length < total && progressed) {
    progressed = false;
    for (const queue of queues) {
      if (out.length >= total) break;
      const next = queue.shift();
      if (next) {
        out.push(next);
        progressed = true;
      }
    }
  }
  return out;
}

describe('media corpus: control group', () => {
  it('probes every pristine seed with real ffprobe', async () => {
    for (const file of pristine()) {
      const result = await settle(transcoder.getInfo(file.path));
      expectClean(result, `getInfo(${file.name})`);
      if (!result.ok) continue;
      const info = result.value as { duration: number; format: string; streams: unknown[] };
      // A still image legitimately probes with duration 0, and a subtitle file
      // may not probe at all, so the strong contract is scoped to timed media.
      expect(Number.isFinite(info.duration), `getInfo(${file.name}) duration`).toBe(true);
      expect(info.duration, `getInfo(${file.name}) duration`).toBeGreaterThanOrEqual(0);
      if (file.family === 'video' || file.family === 'audio') {
        expect(info.format, `getInfo(${file.name}) format`).toBeTruthy();
        expect(info.duration, `getInfo(${file.name}) duration`).toBeGreaterThan(0);
        expect(Array.isArray(info.streams) && info.streams.length, `getInfo(${file.name}) streams`).toBeTruthy();
      }
      expectNoBadNumbers(info, `getInfo(${file.name})`);
    }
  }, 180_000);

  it('still produces previews and timeline data for pristine media', async () => {
    const seeds = pristine();
    const video = seeds.find((f) => f.name === 'seed.mp4');
    const timeline = seeds.find((f) => f.name === TIMELINE_SEED);
    const image = seeds.find((f) => f.name === 'seed.jpg');

    expect(video, 'seed.mp4 missing from the corpus').toBeDefined();
    expect(timeline, `${TIMELINE_SEED} missing from the corpus`).toBeDefined();
    expect(image, 'seed.jpg missing from the corpus').toBeDefined();
    if (!video || !timeline || !image) return;

    const preview = await settle(getVideoPreview(video.path));
    expectClean(preview, 'getVideoPreview(seed.mp4)');
    expect(String((preview.ok ? preview.value : null) ?? '')).toMatch(/^data:image\//);

    const stillPreview = await settle(getImagePreview(image.path));
    expectClean(stillPreview, 'getImagePreview(seed.jpg)');
    expect(String((stillPreview.ok ? stillPreview.value : null) ?? '')).toMatch(/^data:image\//);

    // The timeline extractors must be proven to work on good input, otherwise
    // a sweep that only ever sees them return `null` proves nothing about
    // corrupt files at all.
    for (const [name, run] of [
      ['extractWaveform', () => extractWaveform(timeline.path, TIMELINE_DURATION)],
      ['extractThumbnails', () => extractThumbnails(timeline.path, TIMELINE_DURATION)],
    ] as Array<[string, () => Promise<unknown>]>) {
      const result = await settle(run());
      expectClean(result, `${name}(${TIMELINE_SEED})`);
      expect(result.ok && result.value !== null, `${name}(${TIMELINE_SEED}) returned no data for a valid file`).toBe(true);
      if (result.ok) expectNoBadNumbers(result.value, `${name}(${TIMELINE_SEED})`);
    }
  }, 300_000);
});

describe('media corpus: ffprobe on corrupt files', () => {
  it('never hangs, never leaks a non-finite number, never breaks in our code', async () => {
    const files = corrupt();
    const failures: string[] = [];

    for (const file of files) {
      let result: Settled;
      try {
        result = await settle(transcoder.getInfo(file.path));
      } catch (error) {
        // A synchronous throw is itself a defect: getInfo returns a promise.
        failures.push(`${file.name}: synchronous throw ${String(error)}`);
        continue;
      }
      record('getInfo', result);
      if (result.ok) {
        try {
          expectNoBadNumbers(result.value, `getInfo(${file.name})`);
        } catch (error) {
          failures.push(String(error instanceof Error ? error.message : error));
        }
      } else if (result.error.name === 'BudgetExceeded') {
        failures.push(`${file.name}: ffprobe hung past ${CALL_BUDGET_MS}ms`);
      } else if (BUGGY_REJECTIONS.has(result.error.name)) {
        failures.push(`${file.name}: rejected with ${result.error.name}: ${result.error.message}`);
      }
    }

    expect(failures, `corpus size ${files.length}`).toEqual([]);
  }, 900_000);
});

describe('media corpus: image paths on corrupt files', () => {
  it('degrades to null instead of hanging or producing NaN', async () => {
    const images = select((f) => f.family === 'image' && f.kind !== 'pristine');
    const failures: string[] = [];

    for (const file of images) {
      const checks: Array<[string, () => Promise<unknown>]> = [
        ['getImagePreview', () => getImagePreview(file.path)],
        ['getImageFileInfo', () => getImageFileInfo(file.path)],
        ['getImageInfo', () => getImageInfo(file.path)],
      ];
      for (const [name, run] of checks) {
        let result: Settled;
        try {
          result = await settle(run());
        } catch (error) {
          failures.push(`${name}(${file.name}): synchronous throw ${String(error)}`);
          continue;
        }
        record(name, result);
        if (result.ok) {
          try {
            expectNoBadNumbers(result.value, `${name}(${file.name})`);
          } catch (error) {
            failures.push(String(error instanceof Error ? error.message : error));
          }
        } else if (result.error.name === 'BudgetExceeded') {
          failures.push(`${name}(${file.name}): hung past ${CALL_BUDGET_MS}ms`);
        } else if (BUGGY_REJECTIONS.has(result.error.name)) {
          failures.push(`${name}(${file.name}): rejected with ${result.error.name}: ${result.error.message}`);
        }
      }
    }

    expect(failures, `corpus size ${images.length}`).toEqual([]);
  }, 900_000);
});

describe('media corpus: video preview on corrupt files', () => {
  it('returns null or a data URL without hanging', async () => {
    const videos = stratified(
      select((f) => f.family === 'video' && f.kind !== 'pristine'),
      VIDEO_PREVIEW_LIMIT,
    );
    const failures: string[] = [];

    for (const file of videos) {
      let result: Settled;
      try {
        result = await settle(getVideoPreview(file.path));
      } catch (error) {
        failures.push(`getVideoPreview(${file.name}): synchronous throw ${String(error)}`);
        continue;
      }
      record('getVideoPreview', result);
      if (result.ok) {
        const value = result.value as string | null;
        if (value !== null && !/^data:image\//.test(value)) {
          failures.push(`getVideoPreview(${file.name}): unexpected ${String(value).slice(0, 40)}`);
        }
      } else if (result.error.name === 'BudgetExceeded') {
        failures.push(`getVideoPreview(${file.name}): hung past ${CALL_BUDGET_MS}ms`);
      } else if (BUGGY_REJECTIONS.has(result.error.name)) {
        failures.push(`getVideoPreview(${file.name}): rejected with ${result.error.name}: ${result.error.message}`);
      }
    }

    expect(failures, `checked ${videos.length} of the video corpus`).toEqual([]);
  }, 900_000);
});

describe('media corpus: timeline extraction on corrupt files', () => {
  it('settles with null or well-formed data within the budget', async () => {
    const videos = stratified(
      select((f) => f.family === 'video' && f.kind !== 'pristine'),
      TIMELINE_LIMIT,
    );
    const failures: string[] = [];

    // Guard against the sweep going vacuous: if sampling never reaches the
    // audio-bearing seed, a run of all-`null` results would be indistinguishable
    // from "this code path is untested" and the test would pass for free.
    expect(
      videos.map((f) => f.seedName),
      `the ${TIMELINE_LIMIT}-file sample must include a ${TIMELINE_SEED} variant`,
    ).toContain(TIMELINE_SEED);

    for (const file of videos) {
      for (const [name, run] of [
        ['extractWaveform', () => extractWaveform(file.path, TIMELINE_DURATION)],
        ['extractThumbnails', () => extractThumbnails(file.path, TIMELINE_DURATION)],
      ] as Array<[string, () => Promise<unknown>]>) {
        let result: Settled;
        try {
          result = await settle(run());
        } catch (error) {
          failures.push(`${name}(${file.name}): synchronous throw ${String(error)}`);
          continue;
        }
        record(name, result);
        if (result.ok) {
          try {
            expectNoBadNumbers(result.value, `${name}(${file.name})`);
          } catch (error) {
            failures.push(String(error instanceof Error ? error.message : error));
          }
        } else if (result.error.name === 'BudgetExceeded') {
          failures.push(`${name}(${file.name}): hung past ${CALL_BUDGET_MS}ms`);
        } else if (BUGGY_REJECTIONS.has(result.error.name)) {
          failures.push(`${name}(${file.name}): rejected with ${result.error.name}: ${result.error.message}`);
        }
      }
    }

    expect(failures, `checked ${videos.length} of the video corpus`).toEqual([]);
  }, 900_000);
});
