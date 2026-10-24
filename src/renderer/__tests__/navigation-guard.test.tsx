/**
 * @fileoverview Tests for the shared navigation guard used by the Copilot
 * conversation page.
 *
 * The guard has to sit between every internal navigation trigger and the router
 * while remaining transparent when no page has registered a concern. These
 * tests exercise the provider directly with a small harness so the confirm /
 * cancel / bypass behavior is pinned independently of the Copilot UI.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ColorModeProvider } from '../ColorModeContext';
import { NavigationGuardProvider, useNavigationGuard } from '../NavigationGuardContext';

/** Captures the current pathname so route changes are observable. */
let currentPath = '';

function LocationProbe() {
  currentPath = useLocation().pathname;
  return null;
}

/**
 * Minimal stand-in for a page that registers a leave guard.
 * @returns {JSX.Element} Buttons that toggle the guard and navigate.
 */
function GuardHarness() {
  const { navigate, registerGuard } = useNavigationGuard();
  const [active, setActive] = useState(true);

  useEffect(() => registerGuard(() => active), [registerGuard, active]);

  return (
    <>
      <LocationProbe />
      <button data-testid="guard-toggle" onClick={() => setActive((value) => !value)}>
        toggle
      </button>
      <button data-testid="guard-leave" onClick={() => navigate('/other')}>
        leave
      </button>
      <button data-testid="guard-stay" onClick={() => navigate('/')}>
        stay
      </button>
      <Routes>
        <Route path="/" element={<div data-testid="route-home" />} />
        <Route path="/other" element={<div data-testid="route-other" />} />
      </Routes>
    </>
  );
}

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ColorModeProvider>
        <NavigationGuardProvider>
          <GuardHarness />
        </NavigationGuardProvider>
      </ColorModeProvider>
    </MemoryRouter>,
  );
}

describe('NavigationGuardProvider', () => {
  beforeEach(() => {
    currentPath = '';
  });

  it('blocks navigation and keeps the user in place when the guard is canceled', async () => {
    renderGuard();
    expect(await screen.findByTestId('route-home')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('guard-leave'));
    expect(await screen.findByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('route-home')).toBeInTheDocument();
    expect(currentPath).toBe('/');

    fireEvent.click(screen.getByTestId('confirm-cancel'));
    await waitFor(() => expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('route-home')).toBeInTheDocument();
    expect(currentPath).toBe('/');
  });

  it('resumes the parked navigation when the guard is confirmed', async () => {
    renderGuard();
    await screen.findByTestId('route-home');

    fireEvent.click(screen.getByTestId('guard-leave'));
    fireEvent.click(await screen.findByTestId('confirm-confirm'));

    expect(await screen.findByTestId('route-other')).toBeInTheDocument();
    expect(currentPath).toBe('/other');
    await waitFor(() => expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument());
  });

  it('does not prompt once the guard has been removed', async () => {
    renderGuard();
    await screen.findByTestId('route-home');

    fireEvent.click(screen.getByTestId('guard-toggle'));
    fireEvent.click(screen.getByTestId('guard-leave'));

    expect(await screen.findByTestId('route-other')).toBeInTheDocument();
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(currentPath).toBe('/other');
  });

  it('allows navigating to the current route without prompting', async () => {
    renderGuard();
    await screen.findByTestId('route-home');

    fireEvent.click(screen.getByTestId('guard-stay'));

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('route-home')).toBeInTheDocument();
    expect(currentPath).toBe('/');
  });
});
