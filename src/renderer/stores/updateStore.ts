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
 *  - restart-scheduled: installer will be applied on the next app restart
 *  - error: an update operation failed
 */

import { create } from 'zustand';
import type { UpdateInfo, UpdateProgress } from '../../shared/types';
import { recordAnalyticsEvent } from '../../shared/analytics/AnalyticsService';
import { callBridgeVoid, fireAndForgetBridge } from '../utils/bridge-call';
import { createAnalyticsEvent } from '../../shared/analytics/events';

/**
 * Possible states of the update manager UI flow.
 * @typedef {string} UpdateStatus
 */
export type UpdateStatus =
  'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'restart-scheduled' | 'error';

/**
 * State of the update store.
 * @interface UpdateState
 * @property {UpdateStatus} status - Current update lifecycle state.
 * @property {UpdateInfo | null} info - Available update metadata, or null.
 * @property {UpdateProgress | null} progress - Live download progress, or null.
 * @property {string | null} installerPath - Path to the downloaded installer, or null.
 * @property {string | null} scheduledVersion - Version scheduled for next-restart install, or null.
 * @property {boolean} restartScheduled - Whether a next-restart install is armed.
 * @property {string | null} errorMessage - Error message when status is 'error', or null.
 * @property {boolean} dialogOpen - Whether the update dialog is visible.
 * @property {() => void} checkForUpdates - Triggers an update check via IPC.
 * @property {() => void} downloadUpdate - Starts downloading the matched asset.
 * @property {() => void} cancelDownload - Cancels an in-progress download.
 * @property {() => void} installUpdate - Launches the downloaded installer.
 * @property {() => void} installOnRestart - Arms a next-restart install via IPC.
 * @property {() => void} cancelRestartInstall - Disarms a next-restart install via IPC.
 * @property {(url: string) => void} openReleaseNotes - Opens the release page in the browser.
 * @property {() => void} openDialog - Shows the update dialog.
 * @property {() => void} closeDialog - Hides the update dialog.
 * @property {() => void} hydratePendingInstall - Restores an armed next-restart install from the persisted marker.
 * @property {() => void} reset - Resets the store to idle state.
 */
export interface UpdateState {
  status: UpdateStatus;
  info: UpdateInfo | null;
  progress: UpdateProgress | null;
  installerPath: string | null;
  scheduledVersion: string | null;
  restartScheduled: boolean;
  errorMessage: string | null;
  dialogOpen: boolean;
  checkForUpdates: () => void;
  downloadUpdate: () => void;
  cancelDownload: () => void;
  installUpdate: () => void;
  installOnRestart: () => void;
  cancelRestartInstall: () => void;
  openReleaseNotes: (url: string) => void;
  openDialog: () => void;
  closeDialog: () => void;
  hydratePendingInstall: () => void;
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

  function subscribeToEvents(): void {
    if (unsubAvailable) return;

    unsubAvailable =
      window.electronAPI?.onUpdateAvailable((info) => {
        set({ status: 'available', info, progress: null, errorMessage: null, restartScheduled: false });
      }) || null;

    window.electronAPI?.onUpdateNotAvailable(() => {
      set({ status: 'not-available', errorMessage: null });
    });

    window.electronAPI?.onUpdateProgress((progress) => {
      set({ progress });
    });

    window.electronAPI?.onUpdateDownloaded((installerPath) => {
      set({ status: 'downloaded', installerPath, progress: null });
    });

    window.electronAPI?.onUpdateError((message) => {
      set({ status: 'error', errorMessage: message, progress: null });
    });
  }

  /**
   * Subscribing here is guarded because it runs *inside* the store initializer. A bridge method that
   * throws synchronously would otherwise abort `create()` before it returns a state object, leaving a
   * store whose every `get()` is `undefined` - so the 3-second update check below, and any component
   * destructuring an action from this store, would fail with an unrelated-looking
   * `Cannot read properties of undefined`. See `utils/bridge-call.ts`.
   */
  callBridgeVoid(subscribeToEvents, 'update store event subscriptions');

  callBridgeVoid(
    () =>
      setTimeout(() => {
        // The store exists by now, but a defensive guard costs nothing: this is the only caller and it
        // fires 3s after boot with no error path of its own.
        const action = get().checkForUpdates;
        if (typeof action === 'function') action();
      }, 3000),
    'scheduled update check',
  );

  /**
   * Restores a previously armed next-restart install after an app restart.
   * Reads the persisted marker via IPC; when present, the footer shows the
   * pending-install state again so the user can install now or cancel.
   * @returns {void}
   */
  function hydratePendingInstall(): void {
    window.electronAPI
      ?.getPendingInstall()
      .then((pending) => {
        if (!pending) return;
        set({
          status: 'restart-scheduled',
          installerPath: pending.installerPath,
          scheduledVersion: pending.version,
          restartScheduled: true,
        });
      })
      .catch(() => {
        // Failed hydration is non-fatal; the footer simply shows nothing.
      });
  }

  // Guarded for the same reason as `subscribeToEvents`: this is the last thing the initializer does
  // before returning, so a synchronous throw here would leave the store with no state object at all.
  callBridgeVoid(hydratePendingInstall, 'pending install hydration');

  return {
    status: 'idle',
    info: null,
    progress: null,
    installerPath: null,
    scheduledVersion: null,
    restartScheduled: false,
    errorMessage: null,
    dialogOpen: false,

    checkForUpdates: () => {
      set({ status: 'checking', errorMessage: null, progress: null });
      fireAndForgetBridge(() => window.electronAPI?.checkForUpdates(), 'checkForUpdates');
      recordAnalyticsEvent(createAnalyticsEvent('update_check_triggered', { source: 'manual' }));
    },

    downloadUpdate: () => {
      set({ status: 'downloading', progress: null, errorMessage: null, restartScheduled: false });
      fireAndForgetBridge(() => window.electronAPI?.downloadUpdate(), 'downloadUpdate');
      recordAnalyticsEvent(createAnalyticsEvent('update_download_started', {}));
    },

    cancelDownload: () => {
      fireAndForgetBridge(() => window.electronAPI?.cancelDownload(), 'cancelDownload');
      set({ status: 'available', progress: null });
      recordAnalyticsEvent(createAnalyticsEvent('update_download_cancelled', {}));
    },

    installUpdate: () => {
      const { installerPath } = get();
      if (installerPath) {
        fireAndForgetBridge(() => window.electronAPI?.installUpdate(installerPath), 'installUpdate');
        recordAnalyticsEvent(createAnalyticsEvent('update_install_now', {}));
      }
    },

    installOnRestart: () => {
      const { installerPath, info, scheduledVersion } = get();
      if (!installerPath) return;
      const version = info?.version || scheduledVersion || '';
      fireAndForgetBridge(() => window.electronAPI?.scheduleInstallOnRestart(installerPath, version), 'scheduleInstallOnRestart');
      set({ status: 'restart-scheduled', restartScheduled: true, scheduledVersion: version });
      recordAnalyticsEvent(createAnalyticsEvent('update_install_on_restart', {}));
    },

    cancelRestartInstall: () => {
      fireAndForgetBridge(() => window.electronAPI?.cancelRestartInstall(), 'cancelRestartInstall');
      set({ status: 'downloaded', restartScheduled: false });
      recordAnalyticsEvent(createAnalyticsEvent('update_restart_install_cancelled', {}));
    },

    openReleaseNotes: (url: string) => {
      fireAndForgetBridge(() => window.electronAPI?.openReleaseNotes(url), 'openReleaseNotes');
      recordAnalyticsEvent(createAnalyticsEvent('update_release_notes_opened', {}));
    },

    openDialog: () => {
      set({ dialogOpen: true });
      recordAnalyticsEvent(createAnalyticsEvent('update_dialog_opened', { source: 'manual' }));
    },

    closeDialog: () => {
      set({ dialogOpen: false });
    },

    hydratePendingInstall,

    reset: () => {
      set({
        status: 'idle',
        info: null,
        progress: null,
        installerPath: null,
        scheduledVersion: null,
        restartScheduled: false,
        errorMessage: null,
      });
    },
  };
});
