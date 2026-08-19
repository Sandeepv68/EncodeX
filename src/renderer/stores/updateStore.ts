/**
 * @fileoverview Zustand store for the in-app update manager.
 *
 * Manages the update lifecycle: checking for updates, displaying availability,
 * downloading with progress, and installing. The store subscribes to main
 * process events pushed via the preload bridge and exposes actions for the
 * renderer UI to trigger each step.
 *
 * States:
 *  - idle: no update activity
 *  - checking: querying GitHub Releases API
 *  - available: new version found, ready to download
 *  - not-available: app is up to date
 *  - downloading: download in progress with percent/transferred/total
 *  - downloaded: installer ready to launch
 *  - error: an update operation failed
 */

import { create } from 'zustand';
import type { UpdateInfo, UpdateProgress } from '../../shared/types';

/**
 * Possible states of the update manager UI flow.
 * @typedef {string} UpdateStatus
 */
export type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

/**
 * State of the update store.
 * @interface UpdateState
 * @property {UpdateStatus} status - Current update lifecycle state.
 * @property {UpdateInfo | null} info - Available update metadata, or null.
 * @property {UpdateProgress | null} progress - Live download progress, or null.
 * @property {string | null} installerPath - Path to the downloaded installer, or null.
 * @property {string | null} errorMessage - Error message when status is 'error', or null.
 * @property {boolean} dialogOpen - Whether the update dialog is visible.
 * @property {() => void} checkForUpdates - Triggers an update check via IPC.
 * @property {() => void} downloadUpdate - Starts downloading the matched asset.
 * @property {() => void} cancelDownload - Cancels an in-progress download.
 * @property {() => void} installUpdate - Launches the downloaded installer.
 * @property {(url: string) => void} openReleaseNotes - Opens the release page in the browser.
 * @property {() => void} openDialog - Shows the update dialog.
 * @property {() => void} closeDialog - Hides the update dialog.
 * @property {() => void} reset - Resets the store to idle state.
 */
export interface UpdateState {
  status: UpdateStatus;
  info: UpdateInfo | null;
  progress: UpdateProgress | null;
  installerPath: string | null;
  errorMessage: string | null;
  dialogOpen: boolean;
  checkForUpdates: () => void;
  downloadUpdate: () => void;
  cancelDownload: () => void;
  installUpdate: () => void;
  openReleaseNotes: (url: string) => void;
  openDialog: () => void;
  closeDialog: () => void;
  reset: () => void;
}

/**
 * Zustand store for the update manager.
 * Subscribes to main-process update events on creation and exposes actions
 * for each step of the update lifecycle.
 * @const {UseBoundStore<StoreApi<UpdateState>>} useUpdateStore
 */
export const useUpdateStore = create<UpdateState>((set, get) => {
  let unsubAvailable: (() => void) | null = null;
  let unsubNotAvailable: (() => void) | null = null;
  let unsubProgress: (() => void) | null = null;
  let unsubDownloaded: (() => void) | null = null;
  let unsubError: (() => void) | null = null;

  function subscribeToEvents(): void {
    if (unsubAvailable) return;

    unsubAvailable =
      window.electronAPI?.onUpdateAvailable((info) => {
        set({ status: 'available', info, progress: null, errorMessage: null });
      }) || null;

    unsubNotAvailable =
      window.electronAPI?.onUpdateNotAvailable(() => {
        set({ status: 'not-available', errorMessage: null });
      }) || null;

    unsubProgress =
      window.electronAPI?.onUpdateProgress((progress) => {
        set({ progress });
      }) || null;

    unsubDownloaded =
      window.electronAPI?.onUpdateDownloaded((installerPath) => {
        set({ status: 'downloaded', installerPath, progress: null });
      }) || null;

    unsubError =
      window.electronAPI?.onUpdateError((message) => {
        set({ status: 'error', errorMessage: message, progress: null });
      }) || null;
  }

  subscribeToEvents();

  return {
    status: 'idle',
    info: null,
    progress: null,
    installerPath: null,
    errorMessage: null,
    dialogOpen: false,

    checkForUpdates: () => {
      set({ status: 'checking', errorMessage: null, progress: null });
      window.electronAPI?.checkForUpdates();
    },

    downloadUpdate: () => {
      set({ status: 'downloading', progress: null, errorMessage: null });
      window.electronAPI?.downloadUpdate();
    },

    cancelDownload: () => {
      window.electronAPI?.cancelDownload();
      set({ status: 'available', progress: null });
    },

    installUpdate: () => {
      const { installerPath } = get();
      if (installerPath) {
        window.electronAPI?.installUpdate(installerPath);
      }
    },

    openReleaseNotes: (url: string) => {
      window.electronAPI?.openReleaseNotes(url);
    },

    openDialog: () => {
      set({ dialogOpen: true });
    },

    closeDialog: () => {
      set({ dialogOpen: false });
    },

    reset: () => {
      set({
        status: 'idle',
        info: null,
        progress: null,
        installerPath: null,
        errorMessage: null,
      });
    },
  };
});
