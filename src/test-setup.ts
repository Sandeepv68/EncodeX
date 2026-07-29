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

Object.defineProperty(globalThis, 'electronAPI', {
  value: {
    selectFile: vi.fn(),
    selectFiles: vi.fn(),
    selectOutput: vi.fn(),
    getMediaInfo: vi.fn(),
    convertFile: vi.fn(),
    cancelConversion: vi.fn(),
    queueAdd: vi.fn(),
    queueRemove: vi.fn(),
    queueList: vi.fn(),
    queueCancelAll: vi.fn(),
    playerOpen: vi.fn(),
    playerSeek: vi.fn(),
    playerClose: vi.fn(),
    playerGetFrame: vi.fn(),
    onConversionProgress: vi.fn(() => vi.fn()),
    onQueueAdded: vi.fn(() => vi.fn()),
    onQueueRemoved: vi.fn(() => vi.fn()),
    onQueueStatusChange: vi.fn(() => vi.fn()),
    onQueueProgress: vi.fn(() => vi.fn()),
    onQueueCancelled: vi.fn(() => vi.fn()),
    onPlayerFrame: vi.fn(() => vi.fn()),
  },
  writable: true,
});
