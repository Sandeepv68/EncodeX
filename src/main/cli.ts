/**
 * @fileoverview Command-line interface entry point for the EncodeX main process.
 * Parses CLI arguments with Commander and performs media conversion, media info
 * inspection, or timeout-bounded batch conversion from a terminal.
 *
 * `runCli()` is invoked by the main process entry (see index.ts) whenever the
 * app is started with `--cli`, `-h`/`--help`, or two positional arguments
 * (input + output). It builds a `Transcoder` from the requested transcoder
 * type, streams `progress`, `end`, and `error` events from that transcoder, and
 * writes progress to stdout when it is a TTY.
 *
 * Exports:
 *  - runCli() - parses process arguments and runs the requested CLI operation
 *
 * The process is ultimately exited by index.ts with `EXIT_CODES.SUCCESS` or
 * `EXIT_CODES.ERROR` based on the promise resolution of `runCli()`.
 */

import { createTranscoder } from './transcoders/factory';
import { getCliLogo, printCliLogo, CLI_THEME_IDS, DEFAULT_CLI_THEME, isCliThemeId, CliThemeId } from './cli-logo';
import { Logger } from '../shared/logger';
import { ConversionOptions, TranscoderType } from '../shared/types';
import { APP_NAME } from '../shared/app-constants';
import { TRANSCODER_TYPES } from '../shared/transcoder-constants';
import { CLI_CONVERSION_TIMEOUT_MS } from '../shared/constants';
import {
  LOG_ARROW,
  LOG_CLI_CONVERSION_COMPLETED_SUCCESSFULLY,
  LOG_CLI_CONVERSION_FAILED,
  LOG_CONVERSION_TIMED_OUT_AFTER_300S,
  LOG_GETTING_MEDIA_INFO_FOR,
  LOG_INFO_REQUIRES_AN_INPUT_FILE,
  LOG_OPTIONS,
  LOG_PARSING_CLI_ARGS,
  LOG_SHOWING_HELP,
  LOG_STARTING_CONVERSION,
  LOG_TRANSCODER,
} from '../shared/log-constants';

/**
 * Logger instance scoped to the CLI module. Records argument parsing, help
 * display, media-info lookups, and conversion start/completion/failure events.
 * @const {Logger} log
 */
const log = new Logger('main/cli');

/**
 * Parses process arguments and executes the requested CLI operation.
 *
 * The CLI accepts optional `[input]` and `[output]` file arguments plus options
 * that map onto {@link ConversionOptions}: video/audio codecs (`-v`, `-a`),
 * qscale (`-q`), bitrates, pixel format (`--pix-fmt`), scale (`-s`), time cut
 * points (`--start-time`, `--end-time`, `--duration`), lossless `--copy`, and
 * `--no-audio`.
 *
 * Supported invocation behaviors:
 *  - `--info`: prints the media info for the input as JSON and exits. Requires
 *    an input file, otherwise an error is logged and thrown.
 *  - default: runs the conversion, re-emitting `progress`, `end`, and `error`
 *    events from the transcoder. Progress is drawn over the current terminal
 *    line when stdout is a TTY. A hard timeout of `CLI_CONVERSION_TIMEOUT_MS`
 *    (300 s) cancels the transcoder and rejects the operation.
 *  - `-h` / `--help`: prints help output and returns without converting.
 *
 * Argument slicing strips the `--cli` marker and any script arguments so the
 * same binary can be invoked through Electron.
 *
 * @returns {Promise<void>} Resolves when the CLI operation completes (info,
 *   help, or successful conversion); rejects on errors such as a missing
 *   `--info` input or a failed/timed-out conversion.
 * @throws {Error} When `--info` is passed without an input file, or when a
 *   conversion errors or exceeds the conversion timeout.
 */
export async function runCli(): Promise<void> {
  /**
   * Locates the index of the bundled `index.js` script argument in
   * `process.argv`.
   *
   * Walks `process.argv` backwards and returns the index of the first argument
   * ending in `index.js`, or -1 when none matches. The found index is used to
   * slice off Electron/Node runtime arguments so only user-supplied CLI
   * arguments remain.
   * @const {number} scriptIndex
   */
  const scriptIndex = (() => {
    for (let i = process.argv.length - 1; i >= 0; i--) {
      if (process.argv[i].endsWith('index.js')) return i;
    }
    return -1;
  })();
  const userArgs = scriptIndex >= 0 ? process.argv.slice(scriptIndex + 1) : process.argv.slice(2);
  const cliArgs = userArgs.filter((arg) => arg !== '--cli');

  /**
   * Resolves the `--theme` option value from the raw CLI arguments so the logo
   * can be colored before Commander finishes parsing. Supports both `--theme
   * <id>` and `--theme=<id>`; unknown ids fall back to the default theme.
   * @const {CliThemeId} themeId
   */
  const themeId: CliThemeId = (() => {
    const flagIndex = cliArgs.indexOf('--theme');
    const equalsArg = cliArgs.find((arg) => arg.startsWith('--theme='));
    const value = flagIndex >= 0 ? cliArgs[flagIndex + 1] : equalsArg?.slice('--theme='.length);
    return isCliThemeId(value) ? value : DEFAULT_CLI_THEME;
  })();

  const { Command } = await import('commander');
  const program = new Command();

  program
    .name(APP_NAME)
    .configureOutput({ getOutHasColors: () => true })
    .description(`${getCliLogo(themeId)}\nEncodeX - Multimedia conversion tool`)
    .argument('[input]', 'Input file')
    .argument('[output]', 'Output file')
    .option('--transcoder <type>', `Set transcoder type (${TRANSCODER_TYPES.join(', ')})`, TRANSCODER_TYPES[0])
    .option('--theme <id>', `Logo color theme (${CLI_THEME_IDS.join(', ')})`)
    .option('-v, --video-codec <codec>', 'Set video codec (could set copy)')
    .option('-q, --qscale <qscale>', 'Set qscale for video codec', parseInt)
    .option('-a, --audio-codec <codec>', 'Set audio codec (could set copy)')
    .option('--bitrate-video <bitrate>', 'Set bitrate for video codec')
    .option('--bitrate-audio <bitrate>', 'Set bitrate for audio codec')
    .option('--pix-fmt <pix_fmt>', 'Set pixel format for video')
    .option('-s, --scale <scale>', 'Set scale for video (WxH)')
    .option('--start-time <time>', 'Set start time for cutting (HH:MM:SS or seconds)')
    .option('--end-time <time>', 'Set end time for cutting (HH:MM:SS or seconds)')
    .option('--duration <duration>', 'Set duration for cutting (HH:MM:SS or seconds)')
    .option('--copy', 'Lossless copy streams')
    .option('--no-audio', 'Exclude the audio stream from the output')
    .option('--info', 'Show media info and exit')
    /**
     * Executes the requested CLI operation from the parsed Commander arguments.
     *
     * When `opts.info` is set, the input file is mandatory (its absence throws),
     * and the transcoder's media info for it is logged as pretty-printed JSON.
     * Otherwise a `ConversionOptions` object is built from the parsed flags, a
     * transcoder is created via {@link createTranscoder}, and the conversion is
     * run while streaming `progress`, `end`, and `error` events. Progress is
     * drawn over the current terminal line when stdout supports it (write
     * failures are swallowed so non-TTY stdout does not break the conversion).
     * A hard timeout of `CLI_CONVERSION_TIMEOUT_MS` cancels the transcoder and
     * rejects the pending promise.
     *
     * @param {string} [input] - Input file path, or undefined when not supplied.
     * @param {string} [output] - Output file path, or undefined when not supplied.
     * @param {Record<string, unknown>} opts - Parsed Commander option values.
     * @returns {Promise<void>} Resolves when `--info` or the conversion
     *   completes; rejects on a missing `--info` input, a failed conversion, or
     *   a timeout.
     * @throws {Error} When `--info` is used without an input file, when the
     *   conversion errors, or when it exceeds `CLI_CONVERSION_TIMEOUT_MS`.
     */
    .action(async (input, output, opts) => {
      const transcoderType = (opts.transcoder as TranscoderType) || TRANSCODER_TYPES[0];
      const transcoder = createTranscoder(transcoderType);

      if (opts.info) {
        if (!input) {
          log.error(LOG_INFO_REQUIRES_AN_INPUT_FILE);
          console.error('Error: --info requires an input file');
          throw new Error('Missing input file');
        }
        log.info(LOG_GETTING_MEDIA_INFO_FOR, input);
        const info = await transcoder.getInfo(input);
        console.log(JSON.stringify(info, null, 2));
        return;
      }

      const options: ConversionOptions = {};

      if (opts.copy) options.copy = true;
      if (opts.audio === false) options.audio = false;
      if (opts.videoCodec) options.videoCodec = opts.videoCodec;
      if (opts.audioCodec) options.audioCodec = opts.audioCodec;
      if (opts.qscale) options.qscale = opts.qscale;
      if (opts.bitrateVideo) options.videoBitrate = opts.bitrateVideo;
      if (opts.bitrateAudio) options.audioBitrate = opts.bitrateAudio;
      if (opts.pixFmt) options.pixelFormat = opts.pixFmt;
      if (opts.scale) options.scale = opts.scale;
      if (opts.startTime) options.startTime = opts.startTime;
      if (opts.endTime) options.endTime = opts.endTime;
      if (opts.duration) options.duration = opts.duration;

      log.info(LOG_STARTING_CONVERSION, input, LOG_ARROW, output, LOG_TRANSCODER, transcoderType, LOG_OPTIONS, JSON.stringify(options));
      console.log(`Starting conversion: ${input} -> ${output}`);
      console.log(`Transcoder: ${transcoderType}`);
      console.log(`Options: ${JSON.stringify(options)}`);

      await new Promise<void>((resolve, reject) => {
        const emitter = transcoder.convert(input, output, options);
        const timeout = setTimeout(() => {
          log.warn(LOG_CONVERSION_TIMED_OUT_AFTER_300S);
          transcoder.cancel();
          reject(new Error('Conversion timed out'));
        }, CLI_CONVERSION_TIMEOUT_MS);
        /**
         * Re-emits the transcoder's conversion progress to the terminal.
         *
         * Clears and rewrites the current terminal line with the current time,
         * speed, and ETA; write failures are swallowed so non-TTY stdout does
         * not break the conversion.
         * @param {ConversionProgress} progress - Latest conversion progress
         * @returns {void}
         */
        emitter.on('progress', (progress) => {
          try {
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(`Progress: ${progress.time} | Speed: ${progress.speed} | ETA: ${progress.eta}s`);
          } catch {
            /* non-TTY stdout */
          }
        });
        /**
         * Completes the conversion promise on the transcoder's `end` event.
         *
         * Clears the timeout, logs the successful completion, prints a closing
         * message, and resolves the pending promise.
         * @returns {void}
         */
        emitter.on('end', () => {
          clearTimeout(timeout);
          log.info(LOG_CLI_CONVERSION_COMPLETED_SUCCESSFULLY);
          console.log('\nConversion completed successfully!');
          resolve();
        });
        /**
         * Rejects the conversion promise on the transcoder's `error` event.
         *
         * Clears the timeout, logs the failure, prints an error message, and
         * rejects the pending promise with the transcoder's error.
         * @param {Error} err - The error reported by the transcoder
         * @returns {void}
         */
        emitter.on('error', (err) => {
          clearTimeout(timeout);
          log.error(LOG_CLI_CONVERSION_FAILED, err.message);
          console.error('\nConversion failed:', err.message);
          reject(err);
        });
      });
    });

  if (cliArgs.includes('-h') || cliArgs.includes('--help')) {
    log.debug(LOG_SHOWING_HELP);
    program.outputHelp();
    return;
  }

  printCliLogo(themeId);

  log.info(LOG_PARSING_CLI_ARGS, cliArgs);
  await program.parseAsync(cliArgs, { from: 'user' });
}
