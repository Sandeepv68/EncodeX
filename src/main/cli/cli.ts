/**
 * @fileoverview Command-line interface entry point for the EncodeX main process.
 * Parses subcommands (`convert`, `info`, `capabilities`, `compress`,
 * `extract-audio`, `batch`) plus global options, applies legacy flat-usage
 * shims, and dispatches to the per-subcommand handlers.
 *
 * `runCli()` is invoked by the main process entry (see index.ts) whenever the
 * app is started in CLI mode. It resolves on success and throws on failure; the
 * caller maps thrown errors to process exit codes via
 * {@link mapCliErrorToExitCode}.
 */

import { CommanderError, Command } from 'commander';
import { printCliLogo, CliThemeId } from '../cli-logo';
import { Logger } from '../../shared/logger';
import { APP_NAME, EXIT_CODES } from '../../shared/app-constants';
import { CLI_SUBCOMMANDS, CLI_EXIT_USAGE } from '../../shared/constants';
import { isAppError, ErrorCode } from '../../shared/errors';
import { addGlobalOptions, applyGlobalOptions, resolveThemeId, parseTimeout, CliExitError } from './cli-options';
import { runConvert, createCliTranscoder } from './cli-convert';
import { runInfo, runCapabilities } from './cli-info';
import { runCompress, runExtractAudio } from './cli-compress';
import { runBatch } from './cli-batch';

/**
 * Logger instance scoped to the CLI entry module.
 * @const {Logger} log
 */
const log = new Logger('main/cli');

/**
 * Extracts the user-supplied CLI arguments from `process.argv`.
 *
 * Walks `process.argv` backwards for the bundled `index.js` script argument and
 * returns everything after it (stripping the `--cli` marker), so the same
 * binary works through Electron and Node.
 * @returns {string[]} User-supplied CLI arguments.
 */
function getUserArgs(): string[] {
  const scriptIndex = (() => {
    for (let i = process.argv.length - 1; i >= 0; i--) {
      if (process.argv[i].endsWith('index.js')) return i;
    }
    return -1;
  })();
  return (scriptIndex >= 0 ? process.argv.slice(scriptIndex + 1) : process.argv.slice(2)).filter((arg) => arg !== '--cli');
}

/**
 * Converts legacy flat CLI usage into the equivalent subcommand form.
 *
 *  - `encodex in.mp4 out.mp4` / `encodex in.mp4 -v libx264` → `convert …`
 *  - `encodex --info in.mp4` → `info in.mp4`
 *
 * Invocations that already name a subcommand are returned unchanged.
 * @param {string[]} args - Raw user arguments.
 * @returns {string[]} Arguments in subcommand form.
 */
export function applyLegacyShim(args: string[]): string[] {
  if (args.length === 0) return args;
  const hasSubcommand = args.some((arg) => (CLI_SUBCOMMANDS as readonly string[]).includes(arg as never));
  if (hasSubcommand) return args;
  if (args.includes('--info')) {
    return ['info', ...args.filter((arg) => arg !== '--info')];
  }
  const hasPositional = args.some((arg) => arg && !arg.startsWith('-'));
  if (hasPositional) return ['convert', ...args];
  return args;
}

/**
 * Pre-scans raw arguments for global output flags so coloring, quiet, and JSON
 * routing take effect before the logo is printed and subcommands parse.
 * @param {string[]} args - Raw user arguments.
 * @returns {void}
 */
function preApplyOutputFlags(args: string[]): void {
  const global: Record<string, unknown> = {};
  if (args.includes('--no-color')) global.color = false;
  if (args.includes('--json')) global.json = true;
  if (args.includes('--quiet')) global.quiet = true;
  if (args.includes('--verbose')) global.verbose = true;
  applyGlobalOptions(global);
}

/**
 * Registers a subcommand and attaches the shared global options to it so they
 * parse both before and after the subcommand name.
 * @param {Command} program - The parent Commander program.
 * @param {string} name - Subcommand name.
 * @param {string} description - Subcommand description.
 * @returns {Command} The configured subcommand (for chaining options).
 */
function subcommand(program: Command, name: string, description: string): Command {
  const cmd = program.command(name).description(description);
  addGlobalOptions(cmd);
  return cmd;
}

/**
 * Maps a thrown error to a process exit code.
 *
 *  - {@link CliExitError} carries its own exit code.
 *  - AppError CANCELLED → {@link EXIT_CODES.CANCELLED}.
 *  - AppError FILE/FFMPEG/FFPROBE not-found → {@link EXIT_CODES.NOT_FOUND}.
 *  - Everything else → {@link EXIT_CODES.ERROR}.
 *
 * @param {unknown} err - The error thrown by the CLI run.
 * @returns {number} The process exit code to use.
 */
export function mapCliErrorToExitCode(err: unknown): number {
  if (err instanceof CliExitError) return err.exitCode;
  if (isAppError(err)) {
    if (err.code === ErrorCode.CANCELLED) return EXIT_CODES.CANCELLED;
    if (err.code === ErrorCode.FILE_NOT_FOUND || err.code === ErrorCode.FFMPEG_NOT_FOUND || err.code === ErrorCode.FFPROBE_NOT_FOUND) {
      return EXIT_CODES.NOT_FOUND;
    }
  }
  return EXIT_CODES.ERROR;
}

/**
 * Parses process arguments and runs the requested CLI subcommand.
 *
 * Sets up the Commander program with all six subcommands and the shared global
 * options, prints the themed logo, and dispatches to the subcommand handlers.
 * Commander failures (unknown command / usage) are converted into a
 * {@link CliExitError} with the usage exit code.
 *
 * @returns {Promise<void>} Resolves when the CLI operation completes.
 * @throws {Error} Re-throws handler errors; Commander errors are wrapped as
 *   {@link CliExitError} (usage exit code) unless they merely displayed help.
 */
export async function runCli(): Promise<void> {
  const rawArgs = getUserArgs();
  const themeId: CliThemeId = resolveThemeId(rawArgs);
  const args = applyLegacyShim(rawArgs);

  preApplyOutputFlags(args);

  const { Command } = await import('commander');
  const program = new Command();

  program
    .name(APP_NAME)
    .description('Multimedia conversion tool')
    .showHelpAfterError()
    .showSuggestionAfterError()
    .exitOverride();

  addGlobalOptions(program);

  subcommand(program, 'convert', 'Convert a media file to a new format or codec')
    .alias('c')
    .argument('[input]', 'Input file')
    .argument('[output]', 'Output file')
    .option('-o, --output <file>', 'Output file (overrides the positional output)')
    .option('-v, --video-codec <codec>', 'Video encoder (e.g. libx264, copy)')
    .option('-a, --audio-codec <codec>', 'Audio encoder (e.g. aac, copy)')
    .option('--bitrate-video <bitrate>', 'Video bitrate (e.g. 2000k)')
    .option('--bitrate-audio <bitrate>', 'Audio bitrate (e.g. 192k)')
    .option('-q, --qscale <qscale>', 'Video quality scale (1-31)', parseFloat)
    .option('--pix-fmt <pixel_format>', 'Pixel format (e.g. yuv420p)')
    .option('-s, --scale <scale>', 'Output resolution (WxH or percent)')
    .option('--start-time <time>', 'Trim start (HH:MM:SS or seconds)')
    .option('--end-time <time>', 'Trim end (HH:MM:SS or seconds)')
    .option('--duration <time>', 'Max output duration')
    .option('--copy', 'Lossless stream copy')
    .option('--no-audio', 'Exclude audio streams')
    .option('--no-video', 'Exclude video streams')
    .option('--hwaccel', 'Enable hardware acceleration')
    .option('--hwaccel-mode <mode>', 'Hardware acceleration mode (auto|encode)')
    .option('--info', 'Print media info for the input and exit')
    .action(async function (this: Command, input: string | undefined, output: string | undefined, opts: Record<string, unknown>) {
      const global = this.optsWithGlobals() as Record<string, unknown>;
      applyGlobalOptions(global);
      const transcoder = createCliTranscoder(global.transcoder as string);
      if (opts.info) {
        if (!input) throw new CliExitError('convert --info requires an input file', CLI_EXIT_USAGE);
        await runInfo(transcoder, input, global.json === true, themeId);
        return;
      }
      if (!input) throw new CliExitError('convert requires an input file', CLI_EXIT_USAGE);
      const flags = {
        output: opts.output as string | undefined,
        videoCodec: opts.videoCodec as string | undefined,
        audioCodec: opts.audioCodec as string | undefined,
        bitrateVideo: opts.bitrateVideo as string | undefined,
        bitrateAudio: opts.bitrateAudio as string | undefined,
        qscale: opts.qscale as string | undefined,
        pixFmt: opts.pixFmt as string | undefined,
        scale: opts.scale as string | undefined,
        startTime: opts.startTime as string | undefined,
        endTime: opts.endTime as string | undefined,
        duration: opts.duration as string | undefined,
        copy: opts.copy as boolean | undefined,
        audio: opts.audio as boolean | undefined,
        video: opts.video as boolean | undefined,
        hwaccel: opts.hwaccel as boolean | undefined,
        hwaccelMode: opts.hwaccelMode as string | undefined,
      };
      await runConvert({
        input,
        output: (opts.output as string | undefined) ?? output,
        flags,
        transcoder,
        timeoutSeconds: parseTimeout(global),
        themeId,
      });
    });

  subcommand(program, 'info', 'Print media information for a file')
    .argument('<input>', 'Input file')
    .action(async function (this: Command, input: string, opts: Record<string, unknown>) {
      const global = this.optsWithGlobals() as Record<string, unknown>;
      applyGlobalOptions(global);
      const transcoder = createCliTranscoder(global.transcoder as string);
      await runInfo(transcoder, input, global.json === true, themeId);
    });

  subcommand(program, 'capabilities', 'List available encoders and hardware acceleration methods').action(async function (
    this: Command,
    opts: Record<string, unknown>,
  ) {
    const global = this.optsWithGlobals() as Record<string, unknown>;
    applyGlobalOptions(global);
    await runCapabilities(global.json === true, themeId);
  });

  subcommand(program, 'compress', 'Compress an image')
    .argument('<input>', 'Input image')
    .option('-o, --output <file>', 'Output file')
    .option('-f, --format <format>', 'Output format (jpg, png, webp, ...)')
    .option('-q, --quality <qscale>', 'Quality scale (1-31)', parseFloat)
    .option('-s, --scale <scale>', 'Output resolution (WxH or percent)')
    .action(async function (this: Command, input: string, opts: Record<string, unknown>) {
      const global = this.optsWithGlobals() as Record<string, unknown>;
      applyGlobalOptions(global);
      const transcoder = createCliTranscoder(global.transcoder as string);
      await runCompress(
        input,
        {
          output: opts.output as string | undefined,
          format: opts.format as string | undefined,
          quality: opts.quality as string | undefined,
          scale: opts.scale as string | undefined,
        },
        transcoder,
        parseTimeout(global),
        themeId,
      );
    });

  subcommand(program, 'extract-audio', 'Extract the audio track from a media file')
    .alias('audio')
    .argument('<input>', 'Input media file')
    .option('-o, --output <file>', 'Output file')
    .option('-a, --audio-codec <codec>', 'Audio encoder (e.g. libmp3lame)')
    .option('--bitrate-audio <bitrate>', 'Audio bitrate (e.g. 192k)')
    .action(async function (this: Command, input: string, opts: Record<string, unknown>) {
      const global = this.optsWithGlobals() as Record<string, unknown>;
      applyGlobalOptions(global);
      const transcoder = createCliTranscoder(global.transcoder as string);
      await runExtractAudio(
        input,
        {
          output: opts.output as string | undefined,
          audioCodec: opts.audioCodec as string | undefined,
          bitrateAudio: opts.bitrateAudio as string | undefined,
        },
        transcoder,
        parseTimeout(global),
        themeId,
      );
    });

  subcommand(program, 'batch', 'Convert multiple files through the queue')
    .argument('<inputs...>', 'Input files or glob patterns')
    .option('--output-dir <dir>', 'Output directory')
    .option('--suffix <suffix>', 'Output name suffix')
    .option('--concurrency <n>', 'Max parallel conversions', parseInt)
    .option('-v, --video-codec <codec>', 'Video encoder (e.g. libx264, copy)')
    .option('-a, --audio-codec <codec>', 'Audio encoder (e.g. aac, copy)')
    .option('--bitrate-video <bitrate>', 'Video bitrate (e.g. 2000k)')
    .option('--bitrate-audio <bitrate>', 'Audio bitrate (e.g. 192k)')
    .option('-q, --qscale <qscale>', 'Video quality scale (1-31)', parseFloat)
    .option('--pix-fmt <pixel_format>', 'Pixel format (e.g. yuv420p)')
    .option('-s, --scale <scale>', 'Output resolution (WxH or percent)')
    .option('--copy', 'Lossless stream copy')
    .option('--no-audio', 'Exclude audio streams')
    .option('--no-video', 'Exclude video streams')
    .action(async function (this: Command, inputs: string[], opts: Record<string, unknown>) {
      const global = this.optsWithGlobals() as Record<string, unknown>;
      applyGlobalOptions(global);
      await runBatch({
        inputs,
        outputDir: opts.outputDir as string | undefined,
        suffix: opts.suffix as string | undefined,
        concurrency: opts.concurrency as number | undefined,
        flags: {
          videoCodec: opts.videoCodec as string | undefined,
          audioCodec: opts.audioCodec as string | undefined,
          bitrateVideo: opts.bitrateVideo as string | undefined,
          bitrateAudio: opts.bitrateAudio as string | undefined,
          qscale: opts.qscale as string | undefined,
          pixFmt: opts.pixFmt as string | undefined,
          scale: opts.scale as string | undefined,
          copy: opts.copy as boolean | undefined,
          audio: opts.audio as boolean | undefined,
          video: opts.video as boolean | undefined,
        },
        transcoder: global.transcoder as string,
        timeoutSeconds: parseTimeout(global),
        themeId,
      });
    });

  if (args.length === 0) {
    printCliLogo(themeId);
    program.outputHelp();
    return;
  }

  printCliLogo(themeId);
  log.info('cli args', args);

  try {
    await program.parseAsync(args, { from: 'user' });
  } catch (err) {
    if (err instanceof CommanderError) {
      if (err.exitCode === 0) return;
      throw new CliExitError(err.message, CLI_EXIT_USAGE);
    }
    throw err;
  }
}
