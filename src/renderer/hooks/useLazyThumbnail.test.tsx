import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useLazyThumbnail } from './useLazyThumbnail';
import { clearPreviewCache } from '../utils/preview-cache';

const getVideoPreviewMock = vi.mocked(window.electronAPI.getVideoPreview);

/** Callback captured from the most recently constructed observer stub. @type {IntersectionObserverCallback | null} */
let observerCallback: IntersectionObserverCallback | null = null;

/**
 * Replaces the global IntersectionObserver with a stub whose callback the test
 * can invoke to simulate the card entering the viewport.
 * @returns {void}
 */
function stubIntersectionObserver(): void {
  function FakeIntersectionObserver(this: unknown, callback: IntersectionObserverCallback) {
    observerCallback = callback;
  }
  FakeIntersectionObserver.prototype.observe = vi.fn();
  FakeIntersectionObserver.prototype.unobserve = vi.fn();
  FakeIntersectionObserver.prototype.disconnect = vi.fn();
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
}

/**
 * Mirrors how the job cards consume the hook: the returned ref is attached to
 * the card body and the data URL is rendered once it resolves.
 * @param {{ input: string }} props - Component props.
 * @returns {React.JSX.Element} The probe markup.
 */
function ThumbProbe({ input }: { input: string }) {
  const { thumbnail, anchorRef } = useLazyThumbnail(input);
  return (
    <div>
      <div ref={anchorRef} data-testid="anchor" />
      {thumbnail && <img data-testid="thumb" src={thumbnail} alt="" />}
    </div>
  );
}

describe('useLazyThumbnail', () => {
  beforeEach(() => {
    observerCallback = null;
    clearPreviewCache();
    getVideoPreviewMock.mockReset();
    getVideoPreviewMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the preview immediately when IntersectionObserver is unavailable', async () => {
    getVideoPreviewMock.mockResolvedValue('data:image/png;base64,FRAME');
    render(<ThumbProbe input="/in/clip.mkv" />);
    expect(await screen.findByTestId('thumb')).toHaveAttribute('src', 'data:image/png;base64,FRAME');
    expect(getVideoPreviewMock).toHaveBeenCalledWith('/in/clip.mkv');
  });

  it('waits until the anchor scrolls into view before loading', async () => {
    stubIntersectionObserver();
    getVideoPreviewMock.mockResolvedValue('data:image/png;base64,FRAME');
    render(<ThumbProbe input="/in/clip.mkv" />);
    expect(getVideoPreviewMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('thumb')).not.toBeInTheDocument();

    act(() => {
      observerCallback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(await screen.findByTestId('thumb')).toHaveAttribute('src', 'data:image/png;base64,FRAME');
    expect(getVideoPreviewMock).toHaveBeenCalledOnce();
  });

  it('reuses the cached preview when the card mounts again', async () => {
    getVideoPreviewMock.mockResolvedValue('data:image/png;base64,FRAME');
    const first = render(<ThumbProbe input="/in/clip.mkv" />);
    await screen.findByTestId('thumb');
    first.unmount();

    render(<ThumbProbe input="/in/clip.mkv" />);
    expect(screen.getByTestId('thumb')).toHaveAttribute('src', 'data:image/png;base64,FRAME');
    await act(async () => {});
    expect(getVideoPreviewMock).toHaveBeenCalledOnce();
  });

  it('leaves the thumbnail null for files without a preview', async () => {
    render(<ThumbProbe input="/in/track.mp3" />);
    await act(async () => {});
    expect(screen.queryByTestId('thumb')).not.toBeInTheDocument();
    expect(getVideoPreviewMock).not.toHaveBeenCalled();
  });
});
