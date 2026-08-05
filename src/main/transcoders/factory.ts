import { Logger } from '../../shared/logger';
import { TranscoderType } from '../../shared/types';
import { BmfCore } from './bmf-core';
import { FfmpegCore } from './ffmpeg-core';
import { FFToolCore } from './fftool-core';
import type { ITranscoder } from './types';
import { LOG_CREATING_TRANSCODER } from '../../shared/log-constants';

const log = new Logger('main/transcoders/factory');

export function createTranscoder(type: TranscoderType): ITranscoder {
  log.debug(LOG_CREATING_TRANSCODER, type);
  switch (type) {
    case 'FFMPEG':
      return new FfmpegCore();
    case 'FFTOOL':
      return new FFToolCore();
    case 'BMF':
      return new BmfCore();
  }
}
