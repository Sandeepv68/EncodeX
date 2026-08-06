/**
 * @fileoverview Transcoder factory for selecting a backend implementation.
 * Maps a TranscoderType string to a concrete ITranscoder instance (FfmpegCore
 * for the fluent-ffmpeg API, FFToolCore for the raw ffmpeg CLI, BmfCore for the
 * BMF framework). The JobQueue and callers use this factory so the active
 * backend is swappable at runtime without knowing implementation details.
 */

import { Logger } from '../../shared/logger';
import { TranscoderType } from '../../shared/types';
import { BmfCore } from './bmf-core';
import { FfmpegCore } from './ffmpeg-core';
import { FFToolCore } from './fftool-core';
import type { ITranscoder } from './types';
import { LOG_CREATING_TRANSCODER } from '../../shared/log-constants';

/**
 * Logger instance scoped to the transcoder factory. Logs each transcoder
 * backend instantiation.
 * @const {Logger} log
 */
const log = new Logger('main/transcoders/factory');

/**
 * Creates a transcoder instance for the given backend type.
 *
 * Dispatches on the TranscoderType string:
 * - `'FFMPEG'` -> {@link FfmpegCore} (fluent-ffmpeg API, ffprobe via library)
 * - `'FFTOOL'` -> {@link FFToolCore} (raw ffmpeg/ffprobe CLI subprocesses)
 * - `'BMF'`    -> {@link BmfCore} (BMF framework CLI tools)
 *
 * The exhaustive switch has no default branch; with the `TranscoderType` union
 * the compiler guarantees all cases are handled.
 * @param {TranscoderType} type - Backend identifier: 'FFMPEG', 'FFTOOL', or 'BMF'
 * @returns {ITranscoder} A new, unstarted transcoder instance for the backend
 */
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
