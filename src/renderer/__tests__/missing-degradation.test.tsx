import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { PAGE_ROUTES, renderPage, stubScrollIntoView } from '../../test-utils/page-render';
import { useErrorStore } from '../stores/errorStore';
import { useLogStore } from '../stores/logStore';
import { useQueueStore } from '../stores/queueStore';
import { useAudioExtractStore } from '../stores/audioExtractStore';
import { useDemuxStore } from '../stores/demuxStore';
import { useRemuxStore } from '../stores/remuxStore';
import { useVideoCutStore } from '../stores/videoCutStore';
import { useConversionStore } from '../stores/conversionStore';
import type { MediaInfo } from '../../shared/types';

/**
 * The original bridge stub installed by `test-setup.ts`, captured once so a
 * test that removes `window.electronAPI` can put it back. `delete` cannot be
 * used (the property is not configurable), so "deleted" is modelled exactly as
 * a preload that failed to expose anything: the property reads `undefined`.
 */
const ELECTRON_API_BRIDGE = window.electronAPI;

function removeBridge(): void {
  Object.defineProperty(window, 'electronAPI', { value: undefined, writable: true });
}

function restoreBridge(): void {
  if (window.electronAPI === undefined) {
    Object.defineProperty(window, 'electronAPI', { value: ELECTRON_API_BRIDGE, writable: true });
  }
}

const EMPTY_MEDIA_INFO: MediaInfo = { file: '', format: '', size: 0, duration: 0, bitrate: '', streams: [] };

const TITLES: Record<string, string> = {
  Dashboard: 'dashboard.welcome 👋',
  Convert: 'convert.title',
  MediaInfo: 'mediaInfo.title',
  ImageCompress: 'imageCompress.title',
  AudioExtract: 'audioExtract.title',
  VideoCut: 'videoCut.title',
  Remux: 'remux.title',
  Demux: 'demux.title',
  BatchQueue: 'batchQueue.title',
  Logs: 'logs.noEntries',
  Settings: 'settings.title',
  About: 'about.title',
};

const DROP_LABELS: Record<string, string> = {
  MediaInfo: 'mediaInfo.dropLabel',
  AudioExtract: 'audioExtract.dropLabel',
  VideoCut: 'videoCut.dropLabel',
  Remux: 'remux.dropLabel',
  Demux: 'demux.dropLabel',
};

const FILE_PAGES = ['MediaInfo', 'AudioExtract', 'VideoCut', 'Remux', 'Demux', 'Convert'] as const;
type FilePage = (typeof FILE_PAGES)[number];

function resetStoresAndBridgeDefaults(): void {
  useErrorStore.setState({ currentError: null, errorHistory: [] });
  useLogStore.setState({ entries: [] });
  useQueueStore.setState({ jobs: [], progress: {} });
  vi.mocked(window.electronAPI.queueList).mockResolvedValue([]);
  vi.mocked(window.electronAPI.selectFile).mockResolvedValue(null);
  vi.mocked(window.electronAPI.getMediaInfo).mockResolvedValue(EMPTY_MEDIA_INFO);
}

/**
 * Clicks the file-picking affordance for a page and waits until the bridge
 * round trip reports the chosen path.
 * @param {FilePage} page - The page under test.
 * @param {string} path - The path the picker should return.
 * @returns {Promise<void>} Resolves once `selectFile` has been called.
 */
async function pickFile(page: FilePage, path: string): Promise<void> {
  vi.mocked(window.electronAPI.selectFile).mockResolvedValue(path);
  if (page === 'Convert') {
    fireEvent.click(screen.getByTestId('file-drop-zone'));
  } else {
    fireEvent.click(screen.getByText(DROP_LABELS[page]));
  }
  const acceptArg = page === 'Convert' || ['AudioExtract', 'VideoCut', 'Remux', 'Demux'].includes(page);
  await waitFor(
    () => {
      if (acceptArg) {
        expect(window.electronAPI.selectFile).toHaveBeenCalledWith([{ name: 'Files', extensions: expect.any(Array) }]);
      } else {
        expect(window.electronAPI.selectFile).toHaveBeenCalledWith(undefined);
      }
    },
    { timeout: 10_000 },
  );
}

beforeEach(() => {
  resetStoresAndBridgeDefaults();
  // A successful pick earlier in this file sets each page's input, which hides
  // its drop zone. Reset just the input-bearing page stores so every visitation
  // starts back at the empty (drop-zone) state.
  useAudioExtractStore.setState({ input: '' });
  useDemuxStore.setState({ input: '' });
  useRemuxStore.setState({ input: '' });
  useVideoCutStore.setState({ input: '' });
  useConversionStore.setState({ inputFile: null });
});

describe('5.2 missing-degradation (preload failure: window.electronAPI undefined)', () => {
  afterEach(() => {
    restoreBridge();
  });

  it('declares a non-empty page inventory, or the loop below is vacuous', () => {
    expect(PAGE_ROUTES).toHaveLength(12);
  });

  it.each(PAGE_ROUTES)('$name still mounts without the preload bridge', (spec) => {
    stubScrollIntoView();
    removeBridge();
    const { container, unmount } = renderPage(spec.name);
    expect(container.childElementCount, `${spec.name} rendered an empty tree`).toBeGreaterThan(0);
    expect(screen.getByText(TITLES[spec.name])).toBeInTheDocument();
    unmount();
  });
});

describe('5.2 missing-degradation (getMediaInfo resolves hostile shapes)', () => {
  const EMPTY_OBJECT = {} as MediaInfo;
  const NO_STREAMS: MediaInfo = { file: '/in/video.mp4', format: 'mp4', size: 1, duration: 5, bitrate: '', streams: [] };

  /**
   * The store field each page commits the picked path to. MediaInfo keeps a
   * per-render local state and never hides its drop zone, so it is not in this
   * table.
   */
  const INPUT_STORES: Partial<Record<FilePage, () => string | null>> = {
    AudioExtract: () => useAudioExtractStore.getState().input,
    VideoCut: () => useVideoCutStore.getState().input,
    Remux: () => useRemuxStore.getState().input,
    Demux: () => useDemuxStore.getState().input,
    Convert: () => useConversionStore.getState().inputFile,
  };

  it.each(FILE_PAGES)('%s degrades gracefully when getMediaInfo resolves {}', async (page) => {
    vi.mocked(window.electronAPI.getMediaInfo).mockResolvedValue(EMPTY_OBJECT);
    renderPage(page);
    await pickFile(page, '/in/video.mp4');
    await waitFor(() => expect(window.electronAPI.getMediaInfo).toHaveBeenCalledWith('/in/video.mp4', 'FFMPEG'), {
      timeout: 10_000,
    });
    await waitFor(() => {
      if (page === 'MediaInfo') {
        expect(useErrorStore.getState().currentError, 'MediaInfo surfaces the malformed probe as a user error').not.toBeNull();
        expect(screen.getByText('mediaInfo.dropLabel')).toBeInTheDocument();
      } else if (page === 'AudioExtract') {
        expect(useErrorStore.getState().currentError, 'AudioExtract swallows probe failures by design').toBeNull();
      } else if (page === 'Convert') {
        expect(screen.getByTestId('convert-input-file'), 'Convert keeps its contained file summary').toBeInTheDocument();
      } else {
        expect(screen.getByText(TITLES[page]), `${page} stays on the rendered page after the failed probe`).toBeInTheDocument();
      }
    });
    const inputGetter = INPUT_STORES[page];
    if (inputGetter) {
      expect(inputGetter(), `${page} committed the picked path to its store`).toBe('/in/video.mp4');
    }
  });

  it('MediaInfo keeps the drop zone usable and reports a user error after a malformed probe', async () => {
    vi.mocked(window.electronAPI.getMediaInfo).mockResolvedValue(EMPTY_OBJECT);
    renderPage('MediaInfo');
    await pickFile('MediaInfo', '/in/video.mp4');
    await waitFor(() => expect(useErrorStore.getState().currentError).not.toBeNull());
    expect(screen.getByText('mediaInfo.dropLabel')).toBeInTheDocument();
  });

  it.each(FILE_PAGES)('%s renders a valid-but-stream-less media object without an error', async (page) => {
    vi.mocked(window.electronAPI.getMediaInfo).mockResolvedValue(NO_STREAMS);
    renderPage(page);
    await pickFile(page, '/in/video.mp4');
    await waitFor(() => expect(window.electronAPI.getMediaInfo).toHaveBeenCalledWith('/in/video.mp4', 'FFMPEG'), {
      timeout: 10_000,
    });
    await waitFor(() => {
      if (page === 'MediaInfo') {
        expect(screen.getByTestId('stream-count-chip')).toHaveTextContent('0');
      } else if (page === 'Convert') {
        expect(screen.getByTestId('convert-input-file')).toBeInTheDocument();
      } else {
        expect(screen.getByText(TITLES[page])).toBeInTheDocument();
      }
    });
    expect(useErrorStore.getState().currentError, `${page} should not treat zero streams as a failure`).toBeNull();
    const inputGetter = INPUT_STORES[page];
    if (inputGetter) {
      expect(inputGetter(), `${page} committed the picked path to its store`).toBe('/in/video.mp4');
    }
  });
});
