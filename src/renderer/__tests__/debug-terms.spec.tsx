import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { useTermsStore } from '../stores/termsStore';
import { TERMS_ACCEPTED_STORAGE_KEY } from '../../shared/constants';
import { TERMS_VERSION } from '../../shared/terms';

function renderApp(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  );
}

function dump() {
  return {
    storedAccepted: localStorage.getItem(TERMS_ACCEPTED_STORAGE_KEY),
    storeRequires: useTermsStore.getState().requiresAcceptance,
    storeDialogOpen: useTermsStore.getState().dialogOpen,
    storeMode: useTermsStore.getState().mode,
    modalOpen: !!document.querySelector('.MuiModal-root'),
    anyAriaHidden: Array.from(document.querySelectorAll('[aria-hidden="true"]'))
      .map((n) => n.tagName + '>' + (n.className || ''))
      .slice(0, 5),
    bodyStyle: document.body.getAttribute('style'),
  };
}

describe('debug-terms', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('state at first render', async () => {
    renderApp();
    const snap1 = dump();
    await screen.findByText('dashboard.welcome 👋', {}, { timeout: 10000 }).catch(() => null);
    const snap2 = dump();
    console.log('SNAP1', JSON.stringify(snap1));
    console.log('SNAP2', JSON.stringify(snap2));
    expect(true).toBe(true);
  });

  it('state while navigating to convert', async () => {
    renderApp();
    await screen.findByText('dashboard.welcome 👋', {}, { timeout: 10000 }).catch(() => null);
    const drawerItem = screen.getAllByText('nav.convert')[0]?.closest('[role="button"]');
    if (drawerItem) fireEvent.click(drawerItem);
    await new Promise((r) => setTimeout(r, 1200));
    const snap = dump();
    console.log('CONVERT', JSON.stringify(snap));
    const found = await screen.findByText('convert.title', {}, { timeout: 10000 }).catch(() => null);
    console.log('CONVERT title found?', found ? 'yes' : 'no', 'version', TERMS_VERSION);
    expect(true).toBe(true);
  });
});
