/**
 * @fileoverview Shared in-memory state and event emitter backing the test-mode
 * mock preload (e2e/mocks/preload.js).
 *
 * This module is a plain CommonJS file on purpose: it is `require`d directly by
 * the mock preload inside the Electron renderer process, with no build step.
 * It holds:
 *  - `state` — the mutable results that mocked `electronAPI` methods resolve to
 *    (file dialog results, probed media info, queue jobs, log entries, etc.).
 *  - `subscribe` / `emit` — a tiny pub/sub used to push IPC-style events
 *    (conversion progress, queue changes, log messages) to the renderer.
 *
 * Specs drive it through `window.electronAPI.__test` (see e2e/mocks/control.ts),
 * which is only present when the app runs with `ENCODEX_TEST_MODE=1`.
 */

const listeners = new Map();

function subscribe(channel, cb) {
  if (!listeners.has(channel)) listeners.set(channel, new Set());
  listeners.get(channel).add(cb);
  return () => {
    const set = listeners.get(channel);
    if (set) set.delete(cb);
  };
}

function emit(channel, payload) {
  const set = listeners.get(channel);
  if (set) for (const cb of Array.from(set)) cb(payload);
}

const defaults = {
  selectFileResult: null,
  selectFilesResult: [],
  selectOutputResult: null,
  selectDirectoryResult: null,
  getPathForFileResult: '',
  mediaInfoResult: null,
  imageInfoResult: null,
  imagePreviewResult: null,
  imageFileInfoResult: null,
  videoPreviewResult: null,
  capabilitiesResult: {
    videoEncoders: ['libx264', 'libx265', 'libvpx-vp9'],
    audioEncoders: ['aac', 'libmp3lame', 'opus'],
    hwaccels: ['none', 'vaapi', 'nvenc'],
  },
  compressImageResult: null,
  convertBehavior: 'resolve',
  queueJobs: [],
  queueState: { paused: false, concurrency: 2 },
  queueAddIdCounter: 1,
  playerGeneration: 0,
  playerFrameResult: null,
  playerErrorResult: null,
  waveformResult: null,
  thumbnailsResult: null,
  windowCalls: [],
  loginCalls: [],
  revealCalls: [],
  closeRequestedSubscribers: 0,
};

const state = JSON.parse(JSON.stringify(defaults));
state.convertHoldResolve = null;
state.convertHoldReject = null;

function reset() {
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, JSON.parse(JSON.stringify(defaults)));
  state.convertHoldResolve = null;
  state.convertHoldReject = null;
  listeners.clear();
}

module.exports = { state, defaults, subscribe, emit, reset };
