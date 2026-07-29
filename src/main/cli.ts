import { FfmpegCore } from './transcoders/ffmpeg-core';
import { FFToolCore } from './transcoders/fftool-core';
import { BmfCore } from './transcoders/bmf-core';
import { ConversionOptions, TranscoderType } from '../shared/types';
import { APP_NAME, EXIT_CODES } from '../shared/ui-constants';
import { TRANSCODER_TYPES } from '../shared/transcoder-constants';

export async function runCli(): Promise<void> {
  const { Command } = await import('commander');
  const program = new Command();

  program
    .name(APP_NAME)
    .description('EncodeX - Multimedia conversion tool')
    .argument('[input]', 'Input file')
    .argument('[output]', 'Output file')
    .option('--transcoder <type>', `Set transcoder type (${TRANSCODER_TYPES.join(', ')})`, TRANSCODER_TYPES[0])
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
    .option('--info', 'Show media info and exit')
    .action(async (input, output, opts) => {
      const options: ConversionOptions = {};
      const transcoderType = (opts.transcoder as TranscoderType) || TRANSCODER_TYPES[0];

      if (opts.info) {
        const transcoder = createTranscoder(transcoderType);
        try {
          const info = await transcoder.getInfo(input);
          console.log(JSON.stringify(info, null, 2));
        } catch (err: unknown) {
          console.error('Error getting media info:', err instanceof Error ? err.message : String(err));
          process.exit(EXIT_CODES.ERROR);
        }
        process.exit(EXIT_CODES.SUCCESS);
      }

      if (opts.copy) options.copy = true;
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

      const transcoder = createTranscoder(transcoderType);
      console.log(`Starting conversion: ${input} -> ${output}`);
      console.log(`Transcoder: ${transcoderType}`);
      console.log(`Options: ${JSON.stringify(options)}`);

      await new Promise<void>((resolve, reject) => {
        const emitter = transcoder.convert(input, output, options);
        emitter.on('progress', (progress) => {
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(`Progress: ${progress.time} | Speed: ${progress.speed} | ETA: ${progress.eta}s`);
        });
        emitter.on('end', () => {
          console.log('\nConversion completed successfully!');
          resolve();
        });
        emitter.on('error', (err) => {
          console.error('\nConversion failed:', err.message);
          reject(err);
        });
      });
    });

  const cliArgs = process.argv.filter((arg) => arg !== '--cli' && arg !== '--no-sandbox');

  if (cliArgs.includes('-h') || cliArgs.includes('--help')) {
    program.outputHelp();
    return;
  }

  await program.parseAsync(cliArgs);
}

function createTranscoder(type: TranscoderType): FfmpegCore | FFToolCore | BmfCore {
  switch (type) {
    case 'FFMPEG':
      return new FfmpegCore();
    case 'FFTOOL':
      return new FFToolCore();
    case 'BMF':
      return new BmfCore();
  }
}
