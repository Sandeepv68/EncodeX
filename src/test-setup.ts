/**
 * @fileoverview Global vitest test setup for the EncodeX renderer and main
 * process unit tests (loaded via the `setupFiles` entry in the vitest config).
 *
 * Registers the @testing-library/jest-dom matchers and installs two shared
 * test doubles: a `react-i18next` mock whose `useTranslation` hook resolves
 * translation keys through a small inline dictionary (falling back to the key
 * itself, interpolating `{{placeholders}}`), and a `globalThis.electronAPI`
 * stub mirroring the preload bridge so components can be rendered without a
 * real Electron context. Every IPC method resolves to a benign default so
 * tests only need to override the methods they exercise.
 */

import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string | number>) => {
      const map: Record<string, string> = {
        'app.searchLanguage': 'Search languages',
        'progress.time': 'Time',
        'progress.speed': 'Speed',
        'progress.eta': 'ETA',
        'batchQueue.stats': '{{queued}} queued, {{running}} running, {{done}} done, {{failed}} failed',
        'batchQueue.etaEstimate': 'ETA ~{{eta}}',
        'batchQueue.finished': 'Batch finished: {{done}} succeeded, {{failed}} failed',
        'batchQueue.filters.all': 'All',
        'batchQueue.filters.queued': 'Queued',
        'batchQueue.filters.running': 'Running',
        'batchQueue.filters.done': 'Done',
        'batchQueue.filters.failed': 'Failed',
        'batchQueue.search': 'Search files...',
        'batchQueue.editOptionsTitle': 'Edit options for {{file}}',
        'batchQueue.editOptionsSave': 'Save changes',
        'errorBoundary.title': 'Something went wrong',
        'errorBoundary.description': 'An unexpected error occurred.',
        'errorBoundary.tryAgain': 'Try Again',
        'imageCompress.selectedImage': 'Selected image: {{file}}',
        'audioExtract.selectedVideo': 'Selected video: {{file}}',
        'mediaInfo.exifData': 'EXIF Data',
        'mediaInfo.noExif': 'No EXIF data found',
        'mediaInfo.tagKeys.encoder': 'Encoder',
        'mediaInfo.dispositionFlags.default': 'Default',
        'mediaInfo.dispositionFlags.forced': 'Forced',
        'mediaInfo.video': 'Video',
        'mediaInfo.audio': 'Audio',
        'mediaInfo.subtitle': 'Subtitle',
        'closeConfirm.title': 'Close EncodeX?',
        'closeConfirm.message': 'There are jobs in progress or unsaved changes. Closing now will cancel them.',
        'closeConfirm.confirmLabel': 'Close Anyway',
        'closeConfirm.cancelLabel': 'Cancel',
        'nav.blip.converting': 'Converting',
        'nav.blip.extracting': 'Extracting audio',
        'nav.blip.cutting': 'Cutting video',
        'nav.blip.paused': 'Paused',
        'nav.blip.starting': 'Starting',
      };
      let text = map[key] || (opts?.defaultValue as string | undefined) || key;
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          text = text.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(v));
        }
      }
      return text;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const EMPTY_MEDIA_INFO = { file: '', format: '', size: 0, duration: 0, bitrate: '', streams: [] };

Object.defineProperty(globalThis, 'electronAPI', {
  value: {
    getPathForFile: vi.fn(() => ''),
    selectFile: vi.fn().mockResolvedValue(null),
    selectFiles: vi.fn().mockResolvedValue([]),
    selectOutput: vi.fn().mockResolvedValue(null),
    selectDirectory: vi.fn().mockResolvedValue(null),
    getMediaInfo: vi.fn().mockResolvedValue(EMPTY_MEDIA_INFO),
    getImageInfo: vi.fn().mockResolvedValue(null),
    getImagePreview: vi.fn().mockResolvedValue(null),
    getImageFileInfo: vi.fn().mockResolvedValue(null),
    getVideoPreview: vi.fn().mockResolvedValue(null),
    getCapabilities: vi.fn().mockResolvedValue(null),
    convertFile: vi.fn().mockResolvedValue(undefined),
    pauseConversion: vi.fn().mockResolvedValue(undefined),
    resumeConversion: vi.fn().mockResolvedValue(undefined),
    cancelConversion: vi.fn().mockResolvedValue(undefined),
    queueAdd: vi.fn().mockResolvedValue(''),
    queueRemove: vi.fn().mockResolvedValue(undefined),
    queueList: vi.fn().mockResolvedValue([]),
    queueGetState: vi.fn().mockResolvedValue({ paused: false, concurrency: 1 }),
    queueCancelAll: vi.fn().mockResolvedValue(undefined),
    queueClearCompleted: vi.fn().mockResolvedValue(0),
    queueSetConcurrency: vi.fn().mockResolvedValue(undefined),
    queueSetWhenDone: vi.fn().mockResolvedValue(undefined),
    queueMoveTo: vi.fn().mockResolvedValue(true),
    queueUpdateOptions: vi.fn().mockResolvedValue(false),
    queueStart: vi.fn().mockResolvedValue(undefined),
    queuePause: vi.fn().mockResolvedValue(undefined),
    queueResume: vi.fn().mockResolvedValue(undefined),
    queueExport: vi.fn().mockResolvedValue(0),
    queueImport: vi.fn().mockResolvedValue(0),
    onQueueMoved: vi.fn(() => vi.fn()),
    revealFile: vi.fn().mockResolvedValue(undefined),
    playerOpen: vi.fn().mockResolvedValue(undefined),
    playerSeek: vi.fn().mockResolvedValue(undefined),
    playerClose: vi.fn().mockResolvedValue(undefined),
    playerGetFrame: vi.fn().mockResolvedValue(null),
    onPlayerError: vi.fn().mockReturnValue(vi.fn()),
    extractWaveform: vi.fn().mockResolvedValue(null),
    extractThumbnails: vi.fn().mockResolvedValue(null),
    windowMinimize: vi.fn(),
    windowMaximizeToggle: vi.fn(),
    windowClose: vi.fn(),
    windowCloseConfirmed: vi.fn(),
    onWindowCloseRequested: vi.fn(() => vi.fn()),
    windowSetAlwaysOnTop: vi.fn(),
    setLaunchAtLogin: vi.fn(),
    onWindowMaximizedChange: vi.fn(() => vi.fn()),
    onConversionProgress: vi.fn(() => vi.fn()),
    onQueueAdded: vi.fn(() => vi.fn()),
    onQueueRemoved: vi.fn(() => vi.fn()),
    onQueueStatusChange: vi.fn(() => vi.fn()),
    onQueueProgress: vi.fn(() => vi.fn()),
    onQueueCancelled: vi.fn(() => vi.fn()),
    onPlayerFrame: vi.fn(() => vi.fn()),
    onPlayerAudio: vi.fn(() => vi.fn()),
    onLogMessage: vi.fn(() => vi.fn()),
    checkForUpdates: vi.fn().mockResolvedValue(undefined),
    downloadUpdate: vi.fn().mockResolvedValue(undefined),
    installUpdate: vi.fn().mockResolvedValue(undefined),
    cancelDownload: vi.fn().mockResolvedValue(undefined),
    openReleaseNotes: vi.fn().mockResolvedValue(undefined),
    onUpdateAvailable: vi.fn(() => vi.fn()),
    onUpdateNotAvailable: vi.fn(() => vi.fn()),
    onUpdateProgress: vi.fn(() => vi.fn()),
    onUpdateDownloaded: vi.fn(() => vi.fn()),
    onUpdateError: vi.fn(() => vi.fn()),
  },
  writable: true,
});
