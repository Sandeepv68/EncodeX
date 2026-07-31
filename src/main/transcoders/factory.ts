import { Logger } from '../../shared/logger';
import { TranscoderType } from '../../shared/types';
import { BmfCore } from './bmf-core';
import { FfmpegCore } from './ffmpeg-core';
import { FFToolCore } from './fftool-core';
import { ITranscoder } from './interface';

const log = new Logger('main/transcoders/factory');

export function createTranscoder(type: TranscoderType): ITranscoder {
  log.debug('Creating transcoder:', type);
  switch (type) {
    case 'FFMPEG':
      return new FfmpegCore();
    case 'FFTOOL':
      return new FFToolCore();
    case 'BMF':
      return new BmfCore();
  }
}
