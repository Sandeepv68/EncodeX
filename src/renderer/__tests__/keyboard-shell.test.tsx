/**
 * @fileoverview Phase 5.3 keyboard smoke (plan row 5.3): the App shell end of
 * the keyboard story -- global shortcuts (Ctrl+/ help, Alt+N navigation), the
 * bare-key guard against hijacking typed input, and the modal dialog contract
 * (Escape closes, focus returns to the trigger, "Enter" and "Space" activate
 * real controls).
 *
 * The pages themselves are walked in `keyboard-smoke.test.tsx`; this suite
 * renders the full `<App/>` (drawer chrome + global dialogs) because focus
 * return from a modal and the global shortcut layer only exist there. Rendered
 * at 1440px so the permanent drawer (with its condense button) is what a
 * desktop user tabs through.
 *
 * @see plans/ADVERSARIAL_TEST_HARDENING_PLAN.md, 5.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { stubViewportWidth } from '../../test-utils/page-render';
import { expectAppLog, expectCrash } from '../../test-utils/crash-tripwire';
import { useErrorStore } from '../stores/errorStore';
import { useLogStore } from '../stores/logStore';
import { useToastStore } from '../stores/toastStore';
import { useAudioExtractStore } from '../stores/audioExtractStore';
import { useVideoCutStore } from '../stores/videoCutStore';
import { useTermsStore } from '../stores/termsStore';
import { useSettingsStore } from '../stores/settingsStore';
import { DRAWER_CONDENSED_STORAGE_KEY, DEFAULT_DRAWER_CONDENSED } from '../../shared/constants';

describe('5.3 keyboard smoke (app shell: global shortcuts, dialogs, focus return)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    useSettingsStore.setState({ drawerCondensed: DEFAULT_DRAWER_CONDENSED });
    useErrorStore.setState({ currentError: null, errorHistory: [] });
    useLogStore.setState({ entries: [] });
    useToastStore.setState({ toasts: [] });
    useAudioExtractStore.setState({ isConverting: false });
    useVideoCutStore.getState().setIsCutting(false);
    useTermsStore.setState({ requiresAcceptance: false, dialogOpen: false });
  });

  function renderApp(initialEntries: string[] = ['/']) {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <App />
      </MemoryRouter>,
    );
  }

  it('Ctrl+/ opens the shortcuts help and Escape closes it, returning focus to the trigger', async () => {
    // A benign app boot may app-warn; the shell dialogs' transitions settle on
    // timers outside `act`, so the single consoleError carve-out is declared
    // up front, as in the axe suite.
    expectAppLog('warn', /\[WARN\] \[[^\]]*\]/);
    expectCrash('consoleError', /not wrapped in act/);

    const restoreWidth = stubViewportWidth(1440);
    try {
      renderApp();
      await screen.findByText('dashboard.welcome 👋', {}, { timeout: 10000 });

      const trigger = screen.getByTestId('drawer-condense-button');
      trigger.focus();
      expect(document.activeElement).toBe(trigger);

      fireEvent.keyDown(window, { code: 'Slash', key: '/', ctrlKey: true });

      const dialog = await screen.findByTestId('shortcuts-help-dialog', {}, { timeout: 10000 });
      expect(within(dialog).getByText('shortcuts.title')).toBeInTheDocument();
      // A modal must own the focus for the whole time it is open.
      expect(dialog.contains(document.activeElement)).toBe(true);

      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape', code: 'Escape' });

      await waitFor(() => expect(screen.queryByTestId('shortcuts-help-dialog')).not.toBeInTheDocument());
      // Closing a modal must hand focus back to whatever opened it.
      expect(document.activeElement).toBe(trigger);
    } finally {
      restoreWidth();
    }
  });

  it('Space activates the shortcuts-dialog close button', async () => {
    expectAppLog('warn', /\[WARN\] \[[^\]]*\]/);
    expectCrash('consoleError', /not wrapped in act/);

    const restoreWidth = stubViewportWidth(1440);
    try {
      renderApp();
      await screen.findByText('dashboard.welcome 👋', {}, { timeout: 10000 });

      fireEvent.keyDown(window, { code: 'Slash', key: '/', ctrlKey: true });
      const dialog = await screen.findByTestId('shortcuts-help-dialog', {}, { timeout: 10000 });

      const close = within(dialog).getByTestId('shortcuts-help-close');
      close.focus();
      expect(document.activeElement).toBe(close);

      await userEvent.setup().keyboard(' ');
      await waitFor(() => expect(screen.queryByTestId('shortcuts-help-dialog')).not.toBeInTheDocument());
    } finally {
      restoreWidth();
    }
  });

  it('Enter activates a drawer navigation item', async () => {
    expectAppLog('warn', /\[WARN\] \[[^\]]*\]/);
    expectCrash('consoleError', /not wrapped in act/);

    const restoreWidth = stubViewportWidth(1440);
    try {
      renderApp();
      await screen.findByText('dashboard.welcome 👋', {}, { timeout: 10000 });

      const nav = screen.getByTestId('nav-item-convert');
      nav.focus();
      expect(document.activeElement).toBe(nav);

      await userEvent.setup().keyboard('{Enter}');
      await screen.findByText('convert.title', {}, { timeout: 10000 });
    } finally {
      restoreWidth();
    }
  });

  it('Alt+N shortcuts navigate between routes', async () => {
    expectAppLog('warn', /\[WARN\] \[[^\]]*\]/);
    expectCrash('consoleError', /not wrapped in act/);

    const restoreWidth = stubViewportWidth(1440);
    try {
      renderApp();
      await screen.findByText('dashboard.welcome 👋', {}, { timeout: 10000 });

      fireEvent.keyDown(window, { code: 'Digit2', key: '2', altKey: true });
      await screen.findByText('convert.title', {}, { timeout: 10000 });

      fireEvent.keyDown(window, { code: 'Digit7', key: '7', altKey: true });
      await screen.findByText('batchQueue.title', {}, { timeout: 10000 });
      expect(screen.queryByText('convert.title')).not.toBeInTheDocument();
    } finally {
      restoreWidth();
    }
  });

  it('bare number shortcuts navigate only when the user is not typing', async () => {
    expectAppLog('warn', /\[WARN\] \[[^\]]*\]/);
    expectCrash('consoleError', /not wrapped in act/);

    const restoreWidth = stubViewportWidth(1440);
    try {
      renderApp();
      await screen.findByText('dashboard.welcome 👋', {}, { timeout: 10000 });

      // Not typing: a bare '1' on the dashboard navigates to /convert.
      fireEvent.keyDown(document.body, { code: 'Digit1', key: '1' });
      await screen.findByText('convert.title', {}, { timeout: 10000 });

      // Typing: on the batch page the same bare digits are filter shortcuts and
      // must stay silent while focus sits in the search field.
      fireEvent.keyDown(window, { code: 'Digit7', key: '7', altKey: true });
      await screen.findByText('batchQueue.title', {}, { timeout: 10000 });

      const search = screen.getByPlaceholderText('profiles.searchPlaceholder') as HTMLInputElement;
      await userEvent.setup().type(search, '1');

      expect(search.value).toBe('1');
      expect(screen.queryByText('convert.title')).not.toBeInTheDocument();
    } finally {
      restoreWidth();
    }
  });
});
