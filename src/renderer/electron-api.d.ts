import {
  ConversionOptions,
  ConversionProgress,
  MediaInfo,
  QueueJob,
  PlayerFrame,
  PlayerAudioChunk,
  LogEntry,
  EncoderCapabilities,
  WaveformData,
  ThumbnailStrip,
} from '../shared/types';

export interface ElectronAPI {
  getPathForFile(file: File): string;
  selectFile(filters?: Electron.FileFilter[]): Promise<string | null>;
  selectFiles(filters?: Electron.FileFilter[]): Promise<string[]>;
  selectOutput(): Promise<string | null>;
  getMediaInfo(filePath: string, transcoderType: string): Promise<MediaInfo>;
  getCapabilities(): Promise<EncoderCapabilities | null>;
  convertFile(input: string, output: string, options: ConversionOptions, transcoderType: string): Promise<void>;
  pauseConversion(): Promise<void>;
  resumeConversion(): Promise<void>;
  cancelConversion(): Promise<void>;
  queueAdd(input: string, output: string, options: ConversionOptions, transcoder: string): Promise<string>;
  queueRemove(id: string): Promise<void>;
  queueList(): Promise<QueueJob[]>;
  queueCancelAll(): Promise<void>;
  playerOpen(filePath: string): Promise<number>;
  playerSeek(time: string): Promise<number>;
  playerClose(): Promise<void>;
  playerGetFrame(): Promise<PlayerFrame | null>;
  onPlayerError(cb: (message: string) => void): () => void;
  extractWaveform(filePath: string, duration: number): Promise<WaveformData | null>;
  extractThumbnails(filePath: string, duration: number): Promise<ThumbnailStrip | null>;
  windowMinimize(): void;
  windowMaximizeToggle(): void;
  windowClose(): void;
  onWindowMaximizedChange(cb: (maximized: boolean) => void): () => void;
  onConversionProgress(cb: (data: { input: string; output: string; progress: ConversionProgress }) => void): () => void;
  onQueueAdded(cb: (job: QueueJob) => void): () => void;
  onQueueRemoved(cb: (id: string) => void): () => void;
  onQueueStatusChange(cb: (job: QueueJob) => void): () => void;
  onQueueProgress(cb: (data: { job: QueueJob; progress: ConversionProgress }) => void): () => void;
  onQueueCancelled(cb: () => void): () => void;
  onPlayerFrame(cb: (frame: PlayerFrame) => void): () => void;
  onPlayerAudio(cb: (chunk: PlayerAudioChunk) => void): () => void;
  onLogMessage(cb: (entry: LogEntry) => void): () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
