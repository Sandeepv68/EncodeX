/**
 * @fileoverview Test-mode mock preload for e2e UI tests.
 *
 * Loaded by src/main/index.ts instead of the real preload when
 * `ENCODEX_TEST_MODE === '1'`. Exposes the full `window.electronAPI` shape
 * (mirroring src/preload/index.ts / src/renderer/electron-api.d.ts) backed by
 * the shared store in e2e/mocks/main-store.js, plus a `__test` control surface
 * that specs use to drive dialogs, progress/queue/log events, and assert on
 * recorded window/login/reveal calls.
 *
 * Keep in sync with `ElectronAPI` in src/renderer/electron-api.d.ts.
 */

const { contextBridge } = require('electron');
const { state, subscribe, emit } = require('./main-store');

const noop = () => {};

const api = {
  // --- File system & dialogs ------------------------------------------------
  getPathForFile: () => state.getPathForFileResult,
  selectFile: () => Promise.resolve(state.selectFileResult),
  selectFiles: () => Promise.resolve(state.selectFilesResult),
  selectOutput: () => Promise.resolve(state.selectOutputResult),
  selectDirectory: () => Promise.resolve(state.selectDirectoryResult),

  // --- Media/image metadata & previews --------------------------------------
  getMediaInfo: () => Promise.resolve(state.mediaInfoResult),
  getImageInfo: () => Promise.resolve(state.imageInfoResult),
  getImagePreview: () => Promise.resolve(state.imagePreviewResult),
  getImageFileInfo: () => Promise.resolve(state.imageFileInfoResult),
  getVideoPreview: () => Promise.resolve(state.videoPreviewResult),
  getCapabilities: () => Promise.resolve(state.capabilitiesResult),
  compressImage: () => Promise.resolve(state.compressImageResult),

  // --- Single-file conversion ------------------------------------------------
  convertFile: () => {
    if (state.convertBehavior === 'reject') return Promise.reject(new Error('mock conversion failed'));
    if (state.convertBehavior === 'hold') {
      return new Promise((resolve, reject) => {
        state.convertHoldResolve = resolve;
        state.convertHoldReject = reject;
      });
    }
    return Promise.resolve();
  },
  pauseConversion: () => Promise.resolve(),
  resumeConversion: () => Promise.resolve(),
  cancelConversion: () => Promise.resolve(),

  // --- Batch queue -----------------------------------------------------------
  queueAdd: (input, output, options, transcoder, overwrite) => {
    const id = 'mock-job-' + state.queueAddIdCounter++;
    const job = {
      id,
      input,
      output,
      options: options || {},
      transcoder: transcoder || 'FFMPEG',
      status: 'queued',
      progress: 0,
      createdAt: Date.now(),
      overwrite: !!overwrite,
    };
    state.queueJobs.push(job);
    emit('queue-added', job);
    return Promise.resolve(id);
  },
  queueRemove: (id) => {
    state.queueJobs = state.queueJobs.filter((j) => j.id !== id);
    emit('queue-removed', id);
    return Promise.resolve();
  },
  queueList: () => Promise.resolve(JSON.parse(JSON.stringify(state.queueJobs))),
  queueGetState: () => Promise.resolve({ ...state.queueState }),
  queueCancelAll: () => {
    state.queueJobs = state.queueJobs.map((j) => ({ ...j, status: 'queued', progress: 0 }));
    emit('queue-cancelled', {});
    return Promise.resolve();
  },
  queueClearCompleted: () => {
    const before = state.queueJobs.length;
    state.queueJobs = state.queueJobs.filter((j) => j.status !== 'done' && j.status !== 'error');
    return Promise.resolve(before - state.queueJobs.length);
  },
  queueSetConcurrency: (concurrency) => {
    state.queueState.concurrency = concurrency;
    return Promise.resolve();
  },
  queueSetWhenDone: (config) => {
    state.queueState.whenDone = config;
    return Promise.resolve();
  },
  queueMoveTo: (id, toPosition) => {
    emit('queue-moved', { id, toPosition });
    return Promise.resolve(true);
  },
  queueUpdateOptions: (id, options, output) => {
    const job = state.queueJobs.find((j) => j.id === id);
    if (!job) return Promise.resolve(false);
    if (job.status !== 'queued') return Promise.resolve(false);
    job.options = { ...options };
    if (output) job.output = output;
    emit('queue-status-change', job);
    return Promise.resolve(true);
  },
  queuePause: () => {
    state.queueState.paused = true;
    return Promise.resolve();
  },
  queueResume: () => {
    state.queueState.paused = false;
    return Promise.resolve();
  },
  queueStart: () => {
    state.queueState.paused = false;
    return Promise.resolve();
  },
  queueExport: () => Promise.resolve(state.queueJobs.length),
  queueImport: () => Promise.resolve(0),
  revealFile: (filePath) => {
    state.revealCalls.push(filePath);
    return Promise.resolve();
  },

  // --- Media player -----------------------------------------------------------
  playerOpen: () => {
    state.playerGeneration += 1;
    return Promise.resolve(state.playerGeneration);
  },
  playerSeek: () => {
    state.playerGeneration += 1;
    return Promise.resolve(state.playerGeneration);
  },
  playerClose: () => Promise.resolve(),
  playerGetFrame: () => Promise.resolve(state.playerFrameResult),
  onPlayerError: (cb) => subscribe('player-error', cb),

  // --- Timeline tools ----------------------------------------------------------
  extractWaveform: () => Promise.resolve(state.waveformResult),
  extractThumbnails: () => Promise.resolve(state.thumbnailsResult),

  // --- Window controls ---------------------------------------------------------
  windowMinimize: () => {
    state.windowCalls.push('minimize');
  },
  windowMaximizeToggle: () => {
    state.windowCalls.push('maximize-toggle');
  },
  windowClose: () => {
    state.windowCalls.push('close');
  },
  windowCloseConfirmed: () => {
    state.windowCalls.push('close-confirmed');
  },
  windowSetAlwaysOnTop: (flag) => {
    state.windowCalls.push('always-on-top:' + flag);
  },
  setLaunchAtLogin: (enabled) => {
    state.loginCalls.push(!!enabled);
  },

  // --- Monitoring consent ------------------------------------------------------
  monitoringGetState: () => Promise.resolve({ enabled: true }),
  monitoringSetEnabled: (enabled) => {
    state.monitoringCalls = state.monitoringCalls || [];
    state.monitoringCalls.push(!!enabled);
    return Promise.resolve({ enabled: !!enabled });
  },

  // --- Event subscriptions (each returns an unsubscribe) -----------------------
  onWindowMaximizedChange: (cb) => subscribe('window-maximized-change', cb),
  onWindowCloseRequested: (cb) => {
    state.closeRequestedSubscribers += 1;
    return subscribe('window-close-requested', cb);
  },
  onConversionProgress: (cb) => subscribe('conversion-progress', cb),
  onQueueAdded: (cb) => subscribe('queue-added', cb),
  onQueueRemoved: (cb) => subscribe('queue-removed', cb),
  onQueueStatusChange: (cb) => subscribe('queue-status-change', cb),
  onQueueProgress: (cb) => subscribe('queue-progress', cb),
  onQueueCancelled: (cb) => subscribe('queue-cancelled', cb),
  onQueueMoved: (cb) => subscribe('queue-moved', cb),
  onPlayerFrame: (cb) => subscribe('player-frame', cb),
  onPlayerAudio: (cb) => subscribe('player-audio', cb),
  onLogMessage: (cb) => subscribe('log-message', cb),

  // --- Update manager ----------------------------------------------------------
  checkForUpdates: () => Promise.resolve(),
  downloadUpdate: () => Promise.resolve(),
  installUpdate: () => Promise.resolve(),
  cancelDownload: () => Promise.resolve(),
  openReleaseNotes: () => Promise.resolve(),
  onUpdateAvailable: (cb) => subscribe('update-available', cb),
  onUpdateNotAvailable: (cb) => subscribe('update-not-available', cb),
  onUpdateProgress: (cb) => subscribe('update-progress', cb),
  onUpdateDownloaded: (cb) => subscribe('update-downloaded', cb),
  onUpdateError: (cb) => subscribe('update-error', cb),

  /**
   * Test-only control surface. Absent from the real preload; used by
   * e2e/specs/*.spec.ts via e2e/mocks/control.ts.
   */
  __test: {
    setSelectFile: (v) => {
      state.selectFileResult = v;
    },
    setSelectFiles: (v) => {
      state.selectFilesResult = v;
    },
    setSelectOutput: (v) => {
      state.selectOutputResult = v;
    },
    setSelectDirectory: (v) => {
      state.selectDirectoryResult = v;
    },
    setMediaInfo: (v) => {
      state.mediaInfoResult = v;
    },
    setImageInfo: (v) => {
      state.imageInfoResult = v;
    },
    setImagePreview: (v) => {
      state.imagePreviewResult = v;
    },
    setImageFileInfo: (v) => {
      state.imageFileInfoResult = v;
    },
    setVideoPreview: (v) => {
      state.videoPreviewResult = v;
    },
    setCapabilities: (v) => {
      state.capabilitiesResult = v;
    },
    setCompressImageResult: (v) => {
      state.compressImageResult = v;
    },
    setConvertBehavior: (v) => {
      state.convertBehavior = v;
    },
    resolveConvert: () => {
      if (state.convertHoldResolve) state.convertHoldResolve();
      state.convertHoldResolve = null;
      state.convertHoldReject = null;
    },
    rejectConvert: () => {
      if (state.convertHoldReject) state.convertHoldReject(new Error('mock conversion failed'));
      state.convertHoldResolve = null;
      state.convertHoldReject = null;
    },
    setQueueJobs: (v) => {
      state.queueJobs = JSON.parse(JSON.stringify(v));
    },
    setQueueState: (v) => {
      Object.assign(state.queueState, v);
    },
    setPlayerFrame: (v) => {
      state.playerFrameResult = v;
    },
    setPlayerError: (v) => {
      state.playerErrorResult = v;
    },
    setWaveform: (v) => {
      state.waveformResult = v;
    },
    setThumbnails: (v) => {
      state.thumbnailsResult = v;
    },
    emit: (channel, payload) => emit(channel, payload),
    reset: () => {
      const { reset } = require('./main-store');
      reset();
    },
    get: () => {
      const { windowCalls, loginCalls, revealCalls, queueJobs, queueState, closeRequestedSubscribers } = state;
      return {
        windowCalls,
        loginCalls,
        revealCalls,
        queueJobs,
        queueState,
        closeRequestedSubscribers,
      };
    },
  },
};

// Fire-and-forget methods the renderer may still call even though it has no
// expectations on them in mock mode.
api.windowClose = api.windowClose || noop;

contextBridge.exposeInMainWorld('electronAPI', api);
