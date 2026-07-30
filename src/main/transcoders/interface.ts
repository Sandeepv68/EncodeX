import { EventEmitter } from 'events';
import { ConversionOptions, ConversionProgress, MediaInfo } from '../../shared/types';

export interface ITranscoder {
  getInfo(input: string): Promise<MediaInfo>;
  convert(input: string, output: string, options: ConversionOptions): EventEmitter;
  cancel(): void;
  pause(): void;
  resume(): void;
  getType(): string;
}
