import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';

const api = {
  selectFile: (filters?: Electron.FileFilter[]) =>
    ipcRenderer.invoke(IPC.SELECT_FILE, filters),
  selectFiles: (filters?: Electron.FileFilter[]) =>
    ipcRenderer.invoke(IPC.SELECT_FILES, filters),
  selectOutput: () => ipcRenderer.invoke(IPC.SELECT_OUTPUT),
  getMediaInfo: (filePath: string, transcoderType: string) =>
    ipcRenderer.invoke(IPC.GET_MEDIA_INFO, filePath, transcoderType),
  convertFile: (input: string, output: string, options: any, transcoderType: string) =>
    ipcRenderer.invoke(IPC.CONVERT_FILE, input, output, options, transcoderType),
  cancelConversion: () => ipcRenderer.invoke(IPC.CANCEL_CONVERSION),
  queueAdd: (input: string, output: string, options: any, transcoder: string) =>
    ipcRenderer.invoke(IPC.QUEUE_ADD, input, output, options, transcoder),
  queueRemove: (id: string) => ipcRenderer.invoke(IPC.QUEUE_REMOVE, id),
  queueList: () => ipcRenderer.invoke(IPC.QUEUE_LIST),
  queueCancelAll: () => ipcRenderer.invoke(IPC.QUEUE_CANCEL_ALL),
  playerOpen: (filePath: string) => ipcRenderer.invoke(IPC.PLAYER_OPEN, filePath),
  playerSeek: (time: string) => ipcRenderer.invoke(IPC.PLAYER_SEEK, time),
  playerClose: () => ipcRenderer.invoke(IPC.PLAYER_CLOSE),
  playerGetFrame: () => ipcRenderer.invoke(IPC.PLAYER_GET_FRAME),

  onConversionProgress: (cb: (data: any) => void) => {
    const handler = (_event: any, data: any) => cb(data);
    ipcRenderer.on(IPC.CONVERSION_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.CONVERSION_PROGRESS, handler);
  },
  onQueueAdded: (cb: (job: any) => void) => {
    const handler = (_event: any, job: any) => cb(job);
    ipcRenderer.on(IPC.QUEUE_ADDED, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_ADDED, handler);
  },
  onQueueRemoved: (cb: (id: string) => void) => {
    const handler = (_event: any, id: string) => cb(id);
    ipcRenderer.on(IPC.QUEUE_REMOVED, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_REMOVED, handler);
  },
  onQueueStatusChange: (cb: (job: any) => void) => {
    const handler = (_event: any, job: any) => cb(job);
    ipcRenderer.on(IPC.QUEUE_STATUS_CHANGE, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_STATUS_CHANGE, handler);
  },
  onQueueProgress: (cb: (data: any) => void) => {
    const handler = (_event: any, data: any) => cb(data);
    ipcRenderer.on(IPC.QUEUE_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_PROGRESS, handler);
  },
  onQueueCancelled: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on(IPC.QUEUE_CANCELLED, handler);
    return () => ipcRenderer.removeListener(IPC.QUEUE_CANCELLED, handler);
  },
  onPlayerFrame: (cb: (frame: any) => void) => {
    const handler = (_event: any, frame: any) => cb(frame);
    ipcRenderer.on(IPC.PLAYER_FRAME, handler);
    return () => ipcRenderer.removeListener(IPC.PLAYER_FRAME, handler);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
