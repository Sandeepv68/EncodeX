import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'progress.time': 'Time',
        'progress.speed': 'Speed',
        'progress.eta': 'ETA',
        'errorBoundary.title': 'Something went wrong',
        'errorBoundary.description': 'An unexpected error occurred.',
        'errorBoundary.tryAgain': 'Try Again',
      };
      return map[key] || key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const EMPTY_MEDIA_INFO = { file: '', format: '', size: 0, duration: 0, bitrate: '', streams: [] };

Object.defineProperty(globalThis, 'electronAPI', {
  value: {
    selectFile: vi.fn().mockResolvedValue(null),
    selectFiles: vi.fn().mockResolvedValue([]),
    selectOutput: vi.fn().mockResolvedValue(null),
    getMediaInfo: vi.fn().mockResolvedValue(EMPTY_MEDIA_INFO),
    convertFile: vi.fn().mockResolvedValue(undefined),
    pauseConversion: vi.fn().mockResolvedValue(undefined),
    resumeConversion: vi.fn().mockResolvedValue(undefined),
    cancelConversion: vi.fn().mockResolvedValue(undefined),
    queueAdd: vi.fn().mockResolvedValue(''),
    queueRemove: vi.fn().mockResolvedValue(undefined),
    queueList: vi.fn().mockResolvedValue([]),
    queueCancelAll: vi.fn().mockResolvedValue(undefined),
    playerOpen: vi.fn().mockResolvedValue(undefined),
    playerSeek: vi.fn().mockResolvedValue(undefined),
    playerClose: vi.fn().mockResolvedValue(undefined),
    playerGetFrame: vi.fn().mockResolvedValue(null),
    onConversionProgress: vi.fn(() => vi.fn()),
    onQueueAdded: vi.fn(() => vi.fn()),
    onQueueRemoved: vi.fn(() => vi.fn()),
    onQueueStatusChange: vi.fn(() => vi.fn()),
    onQueueProgress: vi.fn(() => vi.fn()),
    onQueueCancelled: vi.fn(() => vi.fn()),
    onPlayerFrame: vi.fn(() => vi.fn()),
    onLogMessage: vi.fn(() => vi.fn()),
  },
  writable: true,
});
