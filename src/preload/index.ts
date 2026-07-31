import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { Logger } from '../shared/logger';
import { IPC } from '../shared/ipc-channels';
import { ConversionOptions, ConversionProgress, QueueJob, PlayerFrame, MediaInfo, LogEntry } from '../shared/types';

const log = new Logger('preload');

const api = {
  selectFile: (filters?: Electron.FileFilter[]) => {
    log.debug('selectFile called');
    return ipcRenderer.invoke(IPC.SELECT_FILE, filters) as Promise<string | null>;
  },
  selectFiles: (filters?: Electron.FileFilter[]) => {
    log.debug('selectFiles called');
    return ipcRenderer.invoke(IPC.SELECT_FILES, filters) as Promise<string[]>;
  },
  selectOutput: () => {
    log.debug('selectOutput called');
    return ipcRenderer.invoke(IPC.SELECT_OUTPUT) as Promise<string | null>;
  },
  getMediaInfo: (filePath: string, transcoderType: string) => {
    log.info('getMediaInfo:', filePath, 'transcoder:', transcoderType);
    return ipcRenderer.invoke(IPC.GET_MEDIA_INFO, filePath, transcoderType) as Promise<MediaInfo>;
  },
  convertFile: (input: string, output: string, options: ConversionOptions, transcoderType: string) => {
    log.info('convertFile:', input, '->', output, 'transcoder:', transcoderType);
    return ipcRenderer.invoke(IPC.CONVERT_FILE, input, output, options, transcoderType) as Promise<void>;
  },
  pauseConversion: () => {
    log.info('pauseConversion called');
    return ipcRenderer.invoke(IPC.PAUSE_CONVERSION) as Promise<void>;
  },
  resumeConversion: () => {
    log.info('resumeConversion called');
    return ipcRenderer.invoke(IPC.RESUME_CONVERSION) as Promise<void>;
  },
  cancelConversion: () => {
    log.info('cancelConversion called');
    return ipcRenderer.invoke(IPC.CANCEL_CONVERSION) as Promise<void>;
  },
  queueAdd: (input: string, output: string, options: ConversionOptions, transcoder: string) => {
    log.info('queueAdd:', input, '->', output);
    return ipcRenderer.invoke(IPC.QUEUE_ADD, input, output, options, transcoder) as Promise<string>;
  },
  queueRemove: (id: string) => {
    log.info('queueRemove:', id);
    return ipcRenderer.invoke(IPC.QUEUE_REMOVE, id) as Promise<void>;
  },
  queueList: () => {
    log.debug('queueList called');
    return ipcRenderer.invoke(IPC.QUEUE_LIST) as Promise<QueueJob[]>;
  },
  queueCancelAll: () => {
    log.info('queueCancelAll called');
    return ipcRenderer.invoke(IPC.QUEUE_CANCEL_ALL) as Promise<void>;
  },
  playerOpen: (filePath: string) => {
    log.info('playerOpen:', filePath);
    return ipcRenderer.invoke(IPC.PLAYER_OPEN, filePath) as Promise<void>;
  },
  playerSeek: (time: string) => {
    log.debug('playerSeek:', time);
    return ipcRenderer.invoke(IPC.PLAYER_SEEK, time) as Promise<void>;
  },
  playerClose: () => {
    log.debug('playerClose called');
    return ipcRenderer.invoke(IPC.PLAYER_CLOSE) as Promise<void>;
  },
  playerGetFrame: () => {
    return ipcRenderer.invoke(IPC.PLAYER_GET_FRAME) as Promise<PlayerFrame | null>;
  },

  windowMinimize: () => {
    log.debug('windowMinimize called');
    ipcRenderer.send(IPC.WINDOW_MINIMIZE);
  },
  windowMaximizeToggle: () => {
    log.debug('windowMaximizeToggle called');
    ipcRenderer.send(IPC.WINDOW_MAXIMIZE_TOGGLE);
  },
  windowClose: () => {
    log.debug('windowClose called');
    ipcRenderer.send(IPC.WINDOW_CLOSE);
  },

  onWindowMaximizedChange: (cb: (maximized: boolean) => void) => {
    const handler = (_event: IpcRendererEvent, maximized: boolean) => {
      log.debug('onWindowMaximizedChange:', maximized);
      cb(maximized);
    };
    ipcRenderer.on(IPC.WINDOW_MAXIMIZED_CHANGED, handler);
    return () => ipcRenderer.removeListener(IPC.WINDOW_MAXIMIZED_CHANGED, handler);
  },

  onConversionProgress: (cb: (data: { input: string; output: string; progress: ConversionProgress }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { input: string; output: string; progress: ConversionProgress }) => {
      log.debug('onConversionProgress:', data.input, data.progress.percent.toFixed(1) + '%');
      cb(data);
    };
    ipcRenderer.on(IPC.CONVERSION_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.CONVERSION_PROGRESS, handler);
  },
  onQueueAdded: (cb: (job: QueueJob) => void) => {
    const handler = (_event: IpcRendererEvent, job: QueueJob) => {
      log.info('onQueueAdded:', job.id, job.input);
      cb(job);
    };
    ipcRenderer.on(IPC.QUEUE_ADDED, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_ADDED, handler);
  },
  onQueueRemoved: (cb: (id: string) => void) => {
    const handler = (_event: IpcRendererEvent, id: string) => {
      log.info('onQueueRemoved:', id);
      cb(id);
    };
    ipcRenderer.on(IPC.QUEUE_REMOVED, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_REMOVED, handler);
  },
  onQueueStatusChange: (cb: (job: QueueJob) => void) => {
    const handler = (_event: IpcRendererEvent, job: QueueJob) => {
      log.debug('onQueueStatusChange:', job.id, job.status);
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
      log.info('onQueueCancelled');
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
  onLogMessage: (cb: (entry: LogEntry) => void) => {
    const handler = (_event: IpcRendererEvent, entry: LogEntry) => {
      cb(entry);
    };
    ipcRenderer.on(IPC.LOG_MESSAGE, handler);
    return () => ipcRenderer.removeListener(IPC.LOG_MESSAGE, handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
