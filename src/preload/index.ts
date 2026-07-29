import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC } from '../shared/ipc-channels';
import { ConversionOptions, ConversionProgress, QueueJob, PlayerFrame, MediaInfo } from '../shared/types';

const api = {
  selectFile: (filters?: Electron.FileFilter[]) =>
    ipcRenderer.invoke(IPC.SELECT_FILE, filters) as Promise<string | null>,
  selectFiles: (filters?: Electron.FileFilter[]) =>
    ipcRenderer.invoke(IPC.SELECT_FILES, filters) as Promise<string[]>,
  selectOutput: () =>
    ipcRenderer.invoke(IPC.SELECT_OUTPUT) as Promise<string | null>,
  getMediaInfo: (filePath: string, transcoderType: string) =>
    ipcRenderer.invoke(IPC.GET_MEDIA_INFO, filePath, transcoderType) as Promise<MediaInfo>,
  convertFile: (input: string, output: string, options: ConversionOptions, transcoderType: string) =>
    ipcRenderer.invoke(IPC.CONVERT_FILE, input, output, options, transcoderType) as Promise<void>,
  cancelConversion: () =>
    ipcRenderer.invoke(IPC.CANCEL_CONVERSION) as Promise<void>,
  queueAdd: (input: string, output: string, options: ConversionOptions, transcoder: string) =>
    ipcRenderer.invoke(IPC.QUEUE_ADD, input, output, options, transcoder) as Promise<string>,
  queueRemove: (id: string) =>
    ipcRenderer.invoke(IPC.QUEUE_REMOVE, id) as Promise<void>,
  queueList: () =>
    ipcRenderer.invoke(IPC.QUEUE_LIST) as Promise<QueueJob[]>,
  queueCancelAll: () =>
    ipcRenderer.invoke(IPC.QUEUE_CANCEL_ALL) as Promise<void>,
  playerOpen: (filePath: string) =>
    ipcRenderer.invoke(IPC.PLAYER_OPEN, filePath) as Promise<void>,
  playerSeek: (time: string) =>
    ipcRenderer.invoke(IPC.PLAYER_SEEK, time) as Promise<void>,
  playerClose: () =>
    ipcRenderer.invoke(IPC.PLAYER_CLOSE) as Promise<void>,
  playerGetFrame: () =>
    ipcRenderer.invoke(IPC.PLAYER_GET_FRAME) as Promise<PlayerFrame | null>,

  onConversionProgress: (cb: (data: { input: string; output: string; progress: ConversionProgress }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { input: string; output: string; progress: ConversionProgress }) => cb(data);
    ipcRenderer.on(IPC.CONVERSION_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.CONVERSION_PROGRESS, handler);
  },
  onQueueAdded: (cb: (job: QueueJob) => void) => {
    const handler = (_event: IpcRendererEvent, job: QueueJob) => cb(job);
    ipcRenderer.on(IPC.QUEUE_ADDED, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_ADDED, handler);
  },
  onQueueRemoved: (cb: (id: string) => void) => {
    const handler = (_event: IpcRendererEvent, id: string) => cb(id);
    ipcRenderer.on(IPC.QUEUE_REMOVED, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_REMOVED, handler);
  },
  onQueueStatusChange: (cb: (job: QueueJob) => void) => {
    const handler = (_event: IpcRendererEvent, job: QueueJob) => cb(job);
    ipcRenderer.on(IPC.QUEUE_STATUS_CHANGE, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_STATUS_CHANGE, handler);
  },
  onQueueProgress: (cb: (data: { job: QueueJob; progress: ConversionProgress }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { job: QueueJob; progress: ConversionProgress }) => cb(data);
    ipcRenderer.on(IPC.QUEUE_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_PROGRESS, handler);
  },
  onQueueCancelled: (cb: () => void) => {
    const handler = (_event: IpcRendererEvent) => cb();
    ipcRenderer.on(IPC.QUEUE_CANCELLED, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_CANCELLED, handler);
  },
  onPlayerFrame: (cb: (frame: PlayerFrame) => void) => {
    const handler = (_event: IpcRendererEvent, frame: PlayerFrame) => cb(frame);
    ipcRenderer.on(IPC.PLAYER_FRAME, handler);
    return () => ipcRenderer.removeListener(IPC.PLAYER_FRAME, handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
