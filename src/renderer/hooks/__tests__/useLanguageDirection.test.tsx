import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import i18n from '../../i18n/config';
import { useLanguageDirection } from '../../useLanguageDirection';

describe('useLanguageDirection', () => {
  beforeEach(() => {
    document.dir = '';
    vi.restoreAllMocks();
  });

  it('starts as ltr and sets document.dir for a left-to-right locale', () => {
    i18n.language = 'en-US';
    const { result } = renderHook(() => useLanguageDirection());
    expect(result.current).toBe('ltr');
    expect(document.dir).toBe('ltr');
  });

  it('switches to rtl when the language changes to an RTL locale', async () => {
    i18n.language = 'en-US';
    const { result } = renderHook(() => useLanguageDirection());
    await act(async () => {
      await i18n.changeLanguage('ar-SA');
    });
    expect(result.current).toBe('rtl');
    expect(document.dir).toBe('rtl');
  });

  it('treats Hebrew and the other Arabic locales as RTL', async () => {
    i18n.language = 'en-US';
    const { result } = renderHook(() => useLanguageDirection());
    await act(async () => {
      await i18n.changeLanguage('he-IL');
    });
    expect(result.current).toBe('rtl');
    await act(async () => {
      await i18n.changeLanguage('ar-JO');
    });
    expect(result.current).toBe('rtl');
  });

  it('switches back to ltr when moving away from an RTL locale', async () => {
    i18n.language = 'ar-SA';
    const { result } = renderHook(() => useLanguageDirection());
    expect(result.current).toBe('rtl');
    await act(async () => {
      await i18n.changeLanguage('en-GB');
    });
    expect(result.current).toBe('ltr');
    expect(document.dir).toBe('ltr');
  });

  it('unsubscribes from languageChanged on unmount', () => {
    i18n.language = 'en-US';
    const onSpy = vi.spyOn(i18n, 'on');
    const offSpy = vi.spyOn(i18n, 'off');
    const { unmount } = renderHook(() => useLanguageDirection());
    expect(onSpy).toHaveBeenCalledWith('languageChanged', expect.any(Function));
    unmount();
    expect(offSpy).toHaveBeenCalledWith('languageChanged', onSpy.mock.calls[0][1]);
  });
});
