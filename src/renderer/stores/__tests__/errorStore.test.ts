import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useErrorStore } from '../errorStore';
import { createError, ErrorCode, ERROR_MESSAGES } from '../../../shared/errors';

vi.mock('../../../shared/analytics/AnalyticsService', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../../shared/analytics/AnalyticsService')>();
  return { ...mod, recordAnalyticsEvent: vi.fn() };
});
import { recordAnalyticsEvent } from '../../../shared/analytics/AnalyticsService';

const recordAnalyticsMock = vi.mocked(recordAnalyticsEvent);

describe('errorStore', () => {
  beforeEach(() => {
    useErrorStore.setState({ currentError: null, errorHistory: [] });
    recordAnalyticsMock.mockClear();
  });

  it('starts with no error', () => {
    const state = useErrorStore.getState();
    expect(state.currentError).toBeNull();
    expect(state.errorHistory).toEqual([]);
  });

  it('showError sets currentError', () => {
    useErrorStore.getState().showError(new Error('test error'));
    const state = useErrorStore.getState();
    expect(state.currentError).not.toBeNull();
    expect(state.currentError!.message).toBeDefined();
  });

  it('showError with AppError preserves it', () => {
    const appErr = createError(ErrorCode.FILE_NOT_FOUND, 'custom message');
    useErrorStore.getState().showError(appErr);
    const state = useErrorStore.getState();
    expect(state.currentError!.code).toBe('FILE_NOT_FOUND');
    expect(state.currentError!.message).toBe('custom message');
  });

  it('showErrorMessage sets currentError with matching message', () => {
    useErrorStore.getState().showErrorMessage(ErrorCode.FFMPEG_NOT_FOUND, 'detail');
    const state = useErrorStore.getState();
    expect(state.currentError!.code).toBe('FFMPEG_NOT_FOUND');
  });

  it('showError adds to errorHistory', () => {
    useErrorStore.getState().showError(new Error('err1'));
    useErrorStore.getState().showError(new Error('err2'));
    const state = useErrorStore.getState();
    expect(state.errorHistory).toHaveLength(2);
  });

  it('clearError resets currentError to null', () => {
    useErrorStore.getState().showError(new Error('test'));
    useErrorStore.getState().clearError();
    expect(useErrorStore.getState().currentError).toBeNull();
  });

  it('clearHistory empties errorHistory', () => {
    useErrorStore.getState().showError(new Error('err1'));
    useErrorStore.getState().clearHistory();
    expect(useErrorStore.getState().errorHistory).toEqual([]);
  });

  it('errorHistory caps at 50 entries', () => {
    for (let i = 0; i < 60; i++) {
      useErrorStore.getState().showError(new Error(`err${i}`));
    }
    expect(useErrorStore.getState().errorHistory).toHaveLength(50);
  });

  it('showErrorMessage creates error with correct code', () => {
    useErrorStore.getState().showErrorMessage(ErrorCode.CONVERSION_FAILED, 'conversion detail');
    const state = useErrorStore.getState();
    expect(state.currentError!.code).toBe('CONVERSION_FAILED');
    expect(state.currentError!.detail).toBe('conversion detail');
  });

  it('surfaces FILTERS_REQUIRE_RE_ENCODE with its canonical message', () => {
    useErrorStore.getState().showErrorMessage(ErrorCode.FILTERS_REQUIRE_RE_ENCODE);
    const state = useErrorStore.getState();
    expect(state.currentError!.code).toBe('FILTERS_REQUIRE_RE_ENCODE');
    expect(state.currentError!.message).toBe(ERROR_MESSAGES[ErrorCode.FILTERS_REQUIRE_RE_ENCODE]);
    expect(state.currentError!.message).toMatch(/re-encod/i);
    expect(state.errorHistory).toHaveLength(1);
  });

  it('keeps a caller-supplied detail alongside FILTERS_REQUIRE_RE_ENCODE', () => {
    useErrorStore.getState().showErrorMessage(ErrorCode.FILTERS_REQUIRE_RE_ENCODE, '--video-filters needs a re-encoding target');
    expect(useErrorStore.getState().currentError!.detail).toBe('--video-filters needs a re-encoding target');
  });

  it('surfaces INVALID_VIDEO_FILTERS with its canonical message', () => {
    useErrorStore.getState().showErrorMessage(ErrorCode.INVALID_VIDEO_FILTERS, 'fps=30;rm -rf /');
    const state = useErrorStore.getState();
    expect(state.currentError!.code).toBe('INVALID_VIDEO_FILTERS');
    expect(state.currentError!.message).toBe(ERROR_MESSAGES[ErrorCode.INVALID_VIDEO_FILTERS]);
  });

  it('buckets the filter error codes into a non-unknown analytics category', () => {
    useErrorStore.getState().showErrorMessage(ErrorCode.FILTERS_REQUIRE_RE_ENCODE);
    useErrorStore.getState().showErrorMessage(ErrorCode.INVALID_VIDEO_FILTERS);
    const categories = recordAnalyticsMock.mock.calls.map((c) => (c[0] as { props?: { category?: string } })?.props?.category);
    expect(categories).toEqual(['conversion', 'validation']);
  });
});
