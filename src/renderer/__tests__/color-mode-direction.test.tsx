/**
 * @fileoverview Tests for the text direction owned by the color mode context.
 *
 * The direction has to come from the active locale: booting with a persisted
 * right-to-left language must not paint a left-to-right theme until the user
 * picks a language again, and switching the language at runtime must flip the
 * direction of the already mounted tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

/** A stand-in for the shared i18n instance that can emit locale changes. */
const fakeI18n = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const stub = {
    language: 'en-US',
    on: (event: string, listener: () => void): void => {
      if (event === 'languageChanged') listeners.add(listener);
    },
    off: (event: string, listener: () => void): void => {
      if (event === 'languageChanged') listeners.delete(listener);
    },
    /**
     * Switches the language and notifies the mounted providers.
     * @param {string} language - The new language code.
     * @returns {void}
     */
    switchTo(language: string): void {
      stub.language = language;
      for (const listener of listeners) listener();
    },
    /**
     * Counts the registered locale listeners.
     * @returns {number} The number of listeners.
     */
    listenerCount(): number {
      return listeners.size;
    },
  };
  return stub;
});

vi.mock('../i18n/config', () => ({ default: fakeI18n }));

import { ColorModeProvider, useColorMode } from '../ColorModeContext';

/**
 * Reads the direction out of the context so the test can assert on it.
 * @returns {React.JSX.Element} The rendered direction.
 */
function DirectionProbe() {
  const { direction } = useColorMode();
  return <span data-testid="direction">{direction}</span>;
}

/**
 * Renders the provider around the direction probe.
 * @returns {ReturnType<typeof render>} The render result.
 */
function renderProvider() {
  return render(
    <ColorModeProvider>
      <DirectionProbe />
    </ColorModeProvider>,
  );
}

describe('ColorModeProvider direction', () => {
  beforeEach(() => {
    fakeI18n.language = 'en-US';
  });

  it('boots in RTL when the active locale is right-to-left', () => {
    fakeI18n.language = 'ar-SA';

    renderProvider();

    expect(screen.getByTestId('direction')).toHaveTextContent('rtl');
  });

  it('follows the locale when the language changes while mounted', () => {
    renderProvider();
    expect(screen.getByTestId('direction')).toHaveTextContent('ltr');

    act(() => {
      fakeI18n.switchTo('ar-SA');
    });
    expect(screen.getByTestId('direction')).toHaveTextContent('rtl');

    act(() => {
      fakeI18n.switchTo('en-US');
    });
    expect(screen.getByTestId('direction')).toHaveTextContent('ltr');
  });

  it('stops listening for locale changes on unmount', () => {
    const before = fakeI18n.listenerCount();
    const { unmount } = renderProvider();
    expect(fakeI18n.listenerCount()).toBe(before + 1);

    unmount();

    expect(fakeI18n.listenerCount()).toBe(before);
  });
});
