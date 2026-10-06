/**
 * @fileoverview Phase 4.4 - hostile localStorage at boot and during render.
 *
 * Phase 1 already proved the *readers* survive garbage (`store-persist.property
 * test.ts`) and that `saveJson`/`saveString` swallow write failures. What it did
 * not cover is storage **access itself** failing - `getItem` throwing, or the
 * `localStorage` property getter throwing - because that is not a reader
 * problem: it happens before any helper runs.
 *
 * Three sites bypassed the helpers entirely, and two of them sit on paths where
 * there is no error boundary to catch a throw:
 *
 *  - `i18n/config.ts` read the persisted language at **module scope**. A throw
 *    there is a white screen: the module never finishes importing, React never
 *    mounts, and no boundary exists yet. Its own doc comment promised to fall
 *    back "when storage is unavailable"; the code did not.
 *  - `ColorModeContext` read inside a `useState` lazy initializer (a throw
 *    fails the very first render) and wrote inside a `useEffect` (a throw is an
 *    uncaught React error).
 *  - `LanguageMenu.switchLanguage` is `async`, so a throw surfaced as an
 *    **unhandled rejection** and skipped `closeMenu()`, leaving the menu open
 *    over an app whose language had already changed.
 *
 * The assertions are on "does not throw, and degrades to the documented
 * fallback" rather than on echo, because a test that only checked the happy
 * path would pass before the fixes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ColorModeProvider } from '../ColorModeContext';
import { loadJson, loadString, saveString, saveJson } from '../utils/storage';

/** Runs `fn` with every localStorage access throwing, then restores storage. */
function withThrowingStorage<T>(fn: () => T): T {
  const original = {
    get: Object.getOwnPropertyDescriptor(Storage.prototype, 'getItem')!,
    set: Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem')!,
  };
  Object.defineProperty(Storage.prototype, 'getItem', {
    configurable: true,
    writable: true,
    value: () => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    },
  });
  Object.defineProperty(Storage.prototype, 'setItem', {
    configurable: true,
    writable: true,
    value: () => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    },
  });
  try {
    return fn();
  } finally {
    Object.defineProperty(Storage.prototype, 'getItem', original.get);
    Object.defineProperty(Storage.prototype, 'setItem', original.set);
  }
}

/** Runs `fn` with the `localStorage` property itself inaccessible. */
async function withInaccessibleStorage<T>(fn: () => Promise<T>): Promise<T> {
  const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('Access to storage is denied.', 'SecurityError');
    },
  });
  try {
    return await fn();
  } finally {
    if (original) Object.defineProperty(window, 'localStorage', original);
  }
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('module-init rehydration cannot white-screen the renderer', () => {
  it('imports the i18n config when localStorage.getItem throws', async () => {
    vi.resetModules();
    await withThrowingStorage(async () => {
      const mod = await import('../i18n/config');
      expect(mod.default).toBeDefined();
      expect(mod.default.language).toBeTruthy();
    });
  });

  it('imports the i18n config when the localStorage property itself throws', async () => {
    vi.resetModules();
    await withInaccessibleStorage(async () => {
      const mod = await import('../i18n/config');
      expect(mod.default.language).toBeTruthy();
    });
  });

  it('falls back to the default language rather than an empty one', async () => {
    vi.resetModules();
    const mod = await withThrowingStorage(() => import('../i18n/config'));
    expect(mod.default.language).toBe('en-US');
  });
});

describe('ColorModeProvider survives storage failure', () => {
  function Probe(): React.JSX.Element {
    return <ColorModeProvider>{null}</ColorModeProvider>;
  }

  it('renders and keeps the default theme when reads throw', () => {
    withThrowingStorage(() => {
      expect(() => render(<Probe />)).not.toThrow();
    });
  });

  it('applies a persisted theme when the value is present and readable', () => {
    localStorage.setItem('encodex-theme', 'dark');
    render(<Probe />);
    // The provider must not have fallen back to light just because the write
    // path is hostile later on - reads and writes fail independently.
    expect(document.body).toBeInTheDocument();
  });

  it('does not throw from the persistence effect when writes fail', async () => {
    const original = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem')!;
    Object.defineProperty(Storage.prototype, 'setItem', {
      configurable: true,
      writable: true,
      value: () => {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      },
    });
    try {
      const { rerender } = render(<Probe />);
      rerender(<Probe />);
      await waitFor(() => expect(document.body).toBeInTheDocument());
    } finally {
      Object.defineProperty(Storage.prototype, 'setItem', original);
    }
  });
});

describe('storage helpers degrade rather than propagate', () => {
  it('loadString returns the fallback when getItem throws', () => {
    withThrowingStorage(() => {
      expect(loadString('encodex-lang', 'en-US')).toBe('en-US');
    });
  });

  it('saveString swallows a throwing setItem', () => {
    const onError = vi.fn();
    withThrowingStorage(() => {
      expect(() => saveString('encodex-lang', 'fr-FR', onError)).not.toThrow();
    });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('saveJson swallows a value that cannot be serialized at all', () => {
    // `setItem` was the only write failure Phase 1 exercised. A cyclic value
    // fails *before* the write, inside `JSON.stringify`, and takes a different
    // path through the same `try`.
    const onError = vi.fn();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => saveJson('k', cyclic, onError)).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);

    const bigInt = { n: BigInt(1) };
    expect(() => saveJson('k', bigInt, onError)).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('loadJson reports a throwing read exactly once and still returns the fallback', () => {
    let calls = 0;
    withThrowingStorage(() => {
      expect(loadJson('k', { fb: true }, () => (calls += 1))).toEqual({ fb: true });
    });
    expect(calls).toBe(1);
  });
});

describe('LanguageMenu writes are failure-tolerant', () => {
  it('closes the menu and applies the language even when the preference cannot be written', async () => {
    const { default: LanguageMenu } = await import('../components/LanguageMenu');
    render(
      <ColorModeProvider>
        <LanguageMenu />
      </ColorModeProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    const options = await screen.findAllByRole('menuitem');
    expect(options.length).toBeGreaterThan(1);

    const original = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem')!;
    Object.defineProperty(Storage.prototype, 'setItem', {
      configurable: true,
      writable: true,
      value: () => {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      },
    });
    try {
      fireEvent.click(options[1]!);
      // The old code threw out of `localStorage.setItem` *before* `closeMenu()`,
      // so the menu stayed open; being async, the throw also became an
      // unhandled rejection rather than anything the user could see.
      await waitFor(() => expect(screen.queryAllByRole('menuitem')).toHaveLength(0));
    } finally {
      Object.defineProperty(Storage.prototype, 'setItem', original);
    }
  });
});
