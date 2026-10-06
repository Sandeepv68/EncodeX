/**
 * @fileoverview Property-based argv fuzzing for the CLI parse layer (the
 * Phase-6.1 "argv fuzzing" row of `plans/ADVERSARIAL_TEST_HARDENING_PLAN.md`).
 *
 * Generates hostile argument arrays from a vocabulary of real options,
 * subcommands/aliases, values, and junk, then drives the real Commander program
 * exported by `createCliProgram` and asserts that parsing can only *resolve* or
 * throw a handled error (`CommanderError` or the CLI's own `CliExitError`) --
 * never an arbitrary crash (TypeError / RangeError / uncaught exception) and
 * never a hang. The `run*` handler modules are mocked so a syntactically-valid
 * draw cannot reach ffmpeg or the filesystem; the parse layer itself is real.
 *
 * Because `.exitOverride()` is set, help/usage exits surface as thrown
 * `CommanderError`s instead of `process.exit`; stdout/stderr writers are silenced
 * so help dumps do not flood the test log.
 */

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import fc from 'fast-check';
import { CommanderError } from 'commander';
import { applyLegacyShim, createCliProgram } from '../cli';
import { DEFAULT_CLI_THEME } from '../../cli-logo';
import { CLI_SUBCOMMANDS } from '../../../shared/constants';
import { CliExitError } from '../cli-options';
import { isAppError } from '../../../shared/errors';
import { runConvert } from '../cli-convert';
import { runInfo, runCapabilities } from '../cli-info';
import { runCompress, runExtractAudio } from '../cli-compress';
import { runBatch } from '../cli-batch';
import { runRemux } from '../cli-remux';
import { runDemux } from '../cli-demux';

vi.mock('../cli-convert', () => ({
  runConvert: vi.fn(),
  createCliTranscoder: vi.fn(() => ({})),
}));
vi.mock('../cli-info', () => ({ runInfo: vi.fn(), runCapabilities: vi.fn() }));
vi.mock('../cli-compress', () => ({ runCompress: vi.fn(), runExtractAudio: vi.fn() }));
vi.mock('../cli-batch', () => ({ runBatch: vi.fn() }));
vi.mock('../cli-demux', () => ({ runDemux: vi.fn() }));
vi.mock('../cli-remux', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../cli-remux')>();
  return { ...actual, runRemux: vi.fn() };
});

/**
 * Tokens drawn from to build hostile argv: every subcommand and alias, every
 * real option and value, plus shell metacharacters, path traversal, control
 * bytes, huge numerics, and orphaned toggle/flag shapes.
 */
const TOKENS = [
  // subcommands + aliases
  'convert',
  'c',
  'info',
  'capabilities',
  'compress',
  'extract-audio',
  'audio',
  'batch',
  'remux',
  'rmx',
  'demux',
  'split',
  // convert / batch options
  '-o',
  '--output',
  '-v',
  '--video-codec',
  '-a',
  '--audio-codec',
  '--bitrate-video',
  '--bitrate-audio',
  '-q',
  '--qscale',
  '-s',
  '--scale',
  '--start-time',
  '--end-time',
  '--duration',
  '--copy',
  '--no-audio',
  '--no-video',
  '--hwaccel',
  '--hwaccel-mode',
  '--filters',
  '--preset',
  '--info',
  // global options
  '--json',
  '--quiet',
  '--verbose',
  '--no-color',
  '--transcoder',
  '--theme',
  '--help',
  '-h',
  '--version',
  // batch / compress / remux / demux options
  '--concurrency',
  '--output-dir',
  '--suffix',
  '-f',
  '--format',
  '--map',
  '--add-subtitle',
  '--add-audio',
  '--thumbnail',
  '--chapters',
  '--no-chapters',
  '--subtitle-codec',
  '--no-subtitles',
  '--audio-sync',
  '--set-sync',
  '--video',
  '--audio',
  '--subtitles',
  '--all',
  '--video-container',
  '--audio-codec',
  '--subtitle-format',
  '--video-filters',
  // values and junk
  'in.mp4',
  'out.mkv',
  '*.mp4',
  'a b',
  '../../evil.mp4',
  'C:\\evil',
  '\\\\server\\share',
  '/etc/passwd',
  'NUL',
  'CON',
  '-',
  '--',
  '--=--',
  '-x',
  '0',
  '-1',
  '1',
  '0x10',
  '1e309',
  'NaN',
  'Infinity',
  '00:60:00',
  'eq,scale=iw*2',
  '--preset=fast',
  '--filters=',
  '--quiet=true',
  '--no-color=1',
  '=',
  '&& echo hi',
  '$(id)',
  '\u0000x',
  '\\t\\n',
  '123456789012345678901234567890',
  '...',
  '.',
  '..',
  '日本語',
  '🦀🦀',
];

const hostileArgv = fc.array(fc.constantFrom(...TOKENS), { minLength: 0, maxLength: 8 });

const isHandledCliError = (err: unknown): boolean => err instanceof CommanderError || err instanceof CliExitError || isAppError(err);

describe('CLI parse layer argv fuzz', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('never throws anything but a handled CLI error for hostile argv (raw and legacy-shimmed)', async () => {
    const program = createCliProgram(DEFAULT_CLI_THEME);
    await fc.assert(
      fc.asyncProperty(hostileArgv, async (argv) => {
        for (const candidate of [argv, applyLegacyShim(argv)]) {
          try {
            await program.parseAsync(candidate, { from: 'user' });
          } catch (err) {
            const why = err instanceof Error ? `${err.constructor.name}: ${err.message}` : String(err);
            expect(isHandledCliError(err), `parsing ${JSON.stringify(candidate)} escaped the handled-error contract: ${why}`).toBe(true);
          }
        }
      }),
      { numRuns: 300, timeout: 5000 },
    );
  });

  it('is not vacuous: a valid invocation reaches each subcommand handler once', async () => {
    const program = createCliProgram(DEFAULT_CLI_THEME);
    await program.parseAsync(['convert', 'in.mp4', 'out.mkv', '-v', 'libx264', '--preset=fast'], { from: 'user' });
    expect(runConvert).toHaveBeenCalledTimes(1);

    await program.parseAsync(['info', 'in.mp4'], { from: 'user' });
    expect(runInfo).toHaveBeenCalledTimes(1);

    await program.parseAsync(['capabilities', '--json'], { from: 'user' });
    expect(runCapabilities).toHaveBeenCalledTimes(1);

    await program.parseAsync(['compress', 'pic.png', '-f', 'webp', '-q', '28'], { from: 'user' });
    expect(runCompress).toHaveBeenCalledTimes(1);

    await program.parseAsync(['extract-audio', 'in.mp4', '-o', 'out.mp3'], { from: 'user' });
    expect(runExtractAudio).toHaveBeenCalledTimes(1);

    await program.parseAsync(['batch', '*.mp4', '--concurrency', '2'], { from: 'user' });
    expect(runBatch).toHaveBeenCalledTimes(1);

    await program.parseAsync(['remux', 'in.mkv', '-f', 'mp4'], { from: 'user' });
    expect(runRemux).toHaveBeenCalledTimes(1);

    await program.parseAsync(['demux', 'in.mkv', '--subtitles'], { from: 'user' });
    expect(runDemux).toHaveBeenCalledTimes(1);
  });

  it('aliases and legacy shim reach the same handlers as their canonical forms', async () => {
    const program = createCliProgram(DEFAULT_CLI_THEME);
    await program.parseAsync(['c', 'in.mp4', 'out.mkv'], { from: 'user' });
    expect(runConvert).toHaveBeenCalledTimes(1);
    await program.parseAsync(applyLegacyShim(['in.mp4', 'out.mkv']), { from: 'user' });
    expect(runConvert).toHaveBeenCalledTimes(2);
    await program.parseAsync(['audio', 'in.mp4'], { from: 'user' });
    expect(runExtractAudio).toHaveBeenCalledTimes(1);
    await program.parseAsync(['split', 'in.mkv', '--audio'], { from: 'user' });
    expect(runDemux).toHaveBeenCalledTimes(1);
    await program.parseAsync(['rmx', 'in.mkv', '-f', 'mov'], { from: 'user' });
    expect(runRemux).toHaveBeenCalledTimes(1);
  });
});

describe('applyLegacyShim (argv) fuzz', () => {
  const SUBCOMMAND_OR_ALIAS = new Set<string>([...CLI_SUBCOMMANDS, 'c', 'audio', 'rmx', 'split']);

  it('is a total, deterministic, insertion-only rewrite for any hostile input', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...TOKENS), { minLength: 0, maxLength: 12 }), (argv) => {
        let out: string[] = [];
        expect(() => {
          out = applyLegacyShim(argv);
        }).not.toThrow();
        expect(Array.isArray(out)).toBe(true);

        // A subcommand / alias anywhere means the argv passes through untouched.
        if (argv.some((a) => SUBCOMMAND_OR_ALIAS.has(a))) {
          expect(out).toEqual(argv);
          return;
        }

        // Otherwise the rewrite only prepends a single 'convert' or 'info' and
        // drops every '--info' flag; it never drops, reorders, or edits any
        // other token. This is an exact equality, not an upper bound.
        const prefix = out[0] === 'convert' || out[0] === 'info' ? out.slice(1) : out;
        expect(prefix).toEqual(argv.filter((a) => a !== '--info'));

        // Applying the rewrite again must be a no-op.
        expect(applyLegacyShim(out)).toEqual(out);
      }),
      { numRuns: 200 },
    );
  });

  it('is non-vacuous: the generator exercises every rewrite branch', () => {
    const seen = new Set<string>();
    fc.sample(hostileArgv, 2000).forEach((argv) => {
      if (SUBCOMMAND_OR_ALIAS.has(argv[0] as string)) seen.add('subcommand');
      if (argv.includes('--info')) seen.add('info-flag');
      if (argv.some((a) => a && !a.startsWith('-'))) seen.add('positional');
      if (argv.length === 0) seen.add('empty');
    });
    expect(seen).toEqual(new Set(['subcommand', 'info-flag', 'positional', 'empty']));
  });
});
