/**
 * @fileoverview Preload script for secure IPC bridge.
 * Exposes safe, sandboxed API for renderer process to communicate with main process.
 */

import { contextBridge, ipcRenderer, IpcRendererEvent, webUtils } from 'electron';
import { Logger } from '../shared/logger';
import { IPC } from '../shared/ipc-channels';
import {
  ConversionOptions,
  ConversionProgress,
  QueueJob,
  PlayerFrame,
  PlayerAudioChunk,
  MediaInfo,
  ImageExifData,
  ImageFileInfo,
  LogEntry,
  EncoderCapabilities,
  WaveformData,
  ThumbnailStrip,
} from '../shared/types';
import {
  LOG_ARROW,
  LOG_CANCEL_CONVERSION_CALLED,
  LOG_CONVERT_FILE,
  LOG_DURATION,
  LOG_EXTRACT_THUMBNAILS,
  LOG_EXTRACT_WAVEFORM,
  LOG_GET_CAPABILITIES_CALLED,
  LOG_GET_IMAGE_FILE_INFO,
  LOG_GET_IMAGE_INFO,
  LOG_GET_IMAGE_PREVIEW,
  LOG_GET_MEDIA_INFO,
  LOG_GET_VIDEO_PREVIEW,
  LOG_ON_CONVERSION_PROGRESS,
  LOG_ON_QUEUE_ADDED,
  LOG_ON_QUEUE_CANCELLED,
  LOG_ON_QUEUE_REMOVED,
  LOG_ON_QUEUE_STATUS_CHANGE,
  LOG_ON_WINDOW_MAXIMIZED_CHANGE,
  LOG_PAUSE_CONVERSION_CALLED,
  LOG_PLAYER_CLOSE_CALLED,
  LOG_PLAYER_OPEN,
  LOG_PLAYER_SEEK,
  LOG_QUEUE_ADD,
  LOG_QUEUE_CANCEL_ALL_CALLED,
  LOG_QUEUE_LIST_CALLED,
  LOG_QUEUE_REMOVE,
  LOG_RESUME_CONVERSION_CALLED,
  LOG_SELECT_FILES_CALLED,
  LOG_SELECT_FILE_CALLED,
  LOG_SELECT_OUTPUT_CALLED,
  LOG_TRANSCODER,
  LOG_WINDOW_CLOSE_CALLED,
  LOG_WINDOW_MAXIMIZE_TOGGLE_CALLED,
  LOG_WINDOW_MINIMIZE_CALLED,
  LOG_WINDOW_SET_ALWAYS_ON_TOP_CALLED,
} from '../shared/log-constants';

const log = new Logger('preload');

const api = {
  getPathForFile: (file: File) => {
    return webUtils.getPathForFile(file);
  },
  selectFile: (filters?: Electron.FileFilter[]) => {
    log.debug(LOG_SELECT_FILE_CALLED);
    return ipcRenderer.invoke(IPC.SELECT_FILE, filters) as Promise<string | null>;
  },
  selectFiles: (filters?: Electron.FileFilter[]) => {
    log.debug(LOG_SELECT_FILES_CALLED);
    return ipcRenderer.invoke(IPC.SELECT_FILES, filters) as Promise<string[]>;
  },
  selectOutput: () => {
    log.debug(LOG_SELECT_OUTPUT_CALLED);
    return ipcRenderer.invoke(IPC.SELECT_OUTPUT) as Promise<string | null>;
  },
  getMediaInfo: (filePath: string, transcoderType: string) => {
    log.info(LOG_GET_MEDIA_INFO, filePath, LOG_TRANSCODER, transcoderType);
    return ipcRenderer.invoke(IPC.GET_MEDIA_INFO, filePath, transcoderType) as Promise<MediaInfo>;
  },
  getImageInfo: (filePath: string) => {
    log.info(LOG_GET_IMAGE_INFO, filePath);
    return ipcRenderer.invoke(IPC.GET_IMAGE_INFO, filePath) as Promise<ImageExifData | null>;
  },
  getImagePreview: (filePath: string) => {
    log.info(LOG_GET_IMAGE_PREVIEW, filePath);
    return ipcRenderer.invoke(IPC.GET_IMAGE_PREVIEW, filePath) as Promise<string | null>;
  },
  getImageFileInfo: (filePath: string) => {
    log.info(LOG_GET_IMAGE_FILE_INFO, filePath);
    return ipcRenderer.invoke(IPC.GET_IMAGE_FILE_INFO, filePath) as Promise<ImageFileInfo | null>;
  },
  getVideoPreview: (filePath: string) => {
    log.info(LOG_GET_VIDEO_PREVIEW, filePath);
    return ipcRenderer.invoke(IPC.GET_VIDEO_PREVIEW, filePath) as Promise<string | null>;
  },
  getCapabilities: () => {
    log.debug(LOG_GET_CAPABILITIES_CALLED);
    return ipcRenderer.invoke(IPC.GET_CAPABILITIES) as Promise<EncoderCapabilities | null>;
  },
  convertFile: (input: string, output: string, options: ConversionOptions, transcoderType: string) => {
    log.info(LOG_CONVERT_FILE, input, LOG_ARROW, output, LOG_TRANSCODER, transcoderType);
    return ipcRenderer.invoke(IPC.CONVERT_FILE, input, output, options, transcoderType) as Promise<void>;
  },
  pauseConversion: () => {
    log.info(LOG_PAUSE_CONVERSION_CALLED);
    return ipcRenderer.invoke(IPC.PAUSE_CONVERSION) as Promise<void>;
  },
  resumeConversion: () => {
    log.info(LOG_RESUME_CONVERSION_CALLED);
    return ipcRenderer.invoke(IPC.RESUME_CONVERSION) as Promise<void>;
  },
  cancelConversion: () => {
    log.info(LOG_CANCEL_CONVERSION_CALLED);
    return ipcRenderer.invoke(IPC.CANCEL_CONVERSION) as Promise<void>;
  },
  queueAdd: (input: string, output: string, options: ConversionOptions, transcoder: string) => {
    log.info(LOG_QUEUE_ADD, input, LOG_ARROW, output);
    return ipcRenderer.invoke(IPC.QUEUE_ADD, input, output, options, transcoder) as Promise<string>;
  },
  queueRemove: (id: string) => {
    log.info(LOG_QUEUE_REMOVE, id);
    return ipcRenderer.invoke(IPC.QUEUE_REMOVE, id) as Promise<void>;
  },
  queueList: () => {
    log.debug(LOG_QUEUE_LIST_CALLED);
    return ipcRenderer.invoke(IPC.QUEUE_LIST) as Promise<QueueJob[]>;
  },
  queueCancelAll: () => {
    log.info(LOG_QUEUE_CANCEL_ALL_CALLED);
    return ipcRenderer.invoke(IPC.QUEUE_CANCEL_ALL) as Promise<void>;
  },
  playerOpen: (filePath: string) => {
    log.info(LOG_PLAYER_OPEN, filePath);
    return ipcRenderer.invoke(IPC.PLAYER_OPEN, filePath) as Promise<number>;
  },
  playerSeek: (time: string) => {
    log.debug(LOG_PLAYER_SEEK, time);
    return ipcRenderer.invoke(IPC.PLAYER_SEEK, time) as Promise<number>;
  },
  playerClose: () => {
    log.debug(LOG_PLAYER_CLOSE_CALLED);
    return ipcRenderer.invoke(IPC.PLAYER_CLOSE) as Promise<void>;
  },
  playerGetFrame: () => {
    return ipcRenderer.invoke(IPC.PLAYER_GET_FRAME) as Promise<PlayerFrame | null>;
  },
  extractWaveform: (filePath: string, duration: number) => {
    log.info(LOG_EXTRACT_WAVEFORM, filePath, LOG_DURATION, duration);
    return ipcRenderer.invoke(IPC.EXTRACT_WAVEFORM, filePath, duration) as Promise<WaveformData | null>;
  },
  extractThumbnails: (filePath: string, duration: number) => {
    log.info(LOG_EXTRACT_THUMBNAILS, filePath, LOG_DURATION, duration);
    return ipcRenderer.invoke(IPC.EXTRACT_THUMBNAILS, filePath, duration) as Promise<ThumbnailStrip | null>;
  },

  windowMinimize: () => {
    log.debug(LOG_WINDOW_MINIMIZE_CALLED);
    ipcRenderer.send(IPC.WINDOW_MINIMIZE);
  },
  windowMaximizeToggle: () => {
    log.debug(LOG_WINDOW_MAXIMIZE_TOGGLE_CALLED);
    ipcRenderer.send(IPC.WINDOW_MAXIMIZE_TOGGLE);
  },
  windowClose: () => {
    log.debug(LOG_WINDOW_CLOSE_CALLED);
    ipcRenderer.send(IPC.WINDOW_CLOSE);
  },
  windowSetAlwaysOnTop: (flag: boolean) => {
    log.debug(LOG_WINDOW_SET_ALWAYS_ON_TOP_CALLED, { flag });
    ipcRenderer.send(IPC.WINDOW_SET_ALWAYS_ON_TOP, flag);
  },

  onWindowMaximizedChange: (cb: (maximized: boolean) => void) => {
    const handler = (_event: IpcRendererEvent, maximized: boolean) => {
      log.debug(LOG_ON_WINDOW_MAXIMIZED_CHANGE, maximized);
      cb(maximized);
    };
    ipcRenderer.on(IPC.WINDOW_MAXIMIZED_CHANGED, handler);
    return () => ipcRenderer.removeListener(IPC.WINDOW_MAXIMIZED_CHANGED, handler);
  },

  onConversionProgress: (cb: (data: { input: string; output: string; progress: ConversionProgress }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { input: string; output: string; progress: ConversionProgress }) => {
      log.debug(LOG_ON_CONVERSION_PROGRESS, data.input, data.progress.percent.toFixed(1) + '%');
      cb(data);
    };
    ipcRenderer.on(IPC.CONVERSION_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.CONVERSION_PROGRESS, handler);
  },
  onQueueAdded: (cb: (job: QueueJob) => void) => {
    const handler = (_event: IpcRendererEvent, job: QueueJob) => {
      log.info(LOG_ON_QUEUE_ADDED, job.id, job.input);
      cb(job);
    };
    ipcRenderer.on(IPC.QUEUE_ADDED, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_ADDED, handler);
  },
  onQueueRemoved: (cb: (id: string) => void) => {
    const handler = (_event: IpcRendererEvent, id: string) => {
      log.info(LOG_ON_QUEUE_REMOVED, id);
      cb(id);
    };
    ipcRenderer.on(IPC.QUEUE_REMOVED, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_REMOVED, handler);
  },
  onQueueStatusChange: (cb: (job: QueueJob) => void) => {
    const handler = (_event: IpcRendererEvent, job: QueueJob) => {
      log.debug(LOG_ON_QUEUE_STATUS_CHANGE, job.id, job.status);
      cb(job);
    };
    ipcRenderer.on(IPC.QUEUE_STATUS_CHANGE, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_STATUS_CHANGE, handler);
  },
  onQueueProgress: (cb: (data: { job: QueueJob; progress: ConversionProgress }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { job: QueueJob; progress: ConversionProgress }) => {
      cb(data);
    };
    ipcRenderer.on(IPC.QUEUE_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_PROGRESS, handler);
  },
  onQueueCancelled: (cb: () => void) => {
    const handler = (_event: IpcRendererEvent) => {
      log.info(LOG_ON_QUEUE_CANCELLED);
      cb();
    };
    ipcRenderer.on(IPC.QUEUE_CANCELLED, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_CANCELLED, handler);
  },
  onPlayerFrame: (cb: (frame: PlayerFrame) => void) => {
    const handler = (_event: IpcRendererEvent, frame: PlayerFrame) => {
      cb(frame);
    };
    ipcRenderer.on(IPC.PLAYER_FRAME, handler);
    return () => ipcRenderer.removeListener(IPC.PLAYER_FRAME, handler);
  },
  onPlayerAudio: (cb: (chunk: PlayerAudioChunk) => void) => {
    const handler = (_event: IpcRendererEvent, chunk: PlayerAudioChunk) => {
      cb(chunk);
    };
    ipcRenderer.on(IPC.PLAYER_AUDIO, handler);
    return () => ipcRenderer.removeListener(IPC.PLAYER_AUDIO, handler);
  },
  onPlayerError: (cb: (message: string) => void) => {
    const handler = (_event: IpcRendererEvent, message: string) => {
      cb(message);
    };
    ipcRenderer.on(IPC.PLAYER_ERROR, handler);
    return () => ipcRenderer.removeListener(IPC.PLAYER_ERROR, handler);
  },
  onLogMessage: (cb: (entry: LogEntry) => void) => {
    const handler = (_event: IpcRendererEvent, entry: LogEntry) => {
      cb(entry);
    };
    ipcRenderer.on(IPC.LOG_MESSAGE, handler);
    return () => ipcRenderer.removeListener(IPC.LOG_MESSAGE, handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
