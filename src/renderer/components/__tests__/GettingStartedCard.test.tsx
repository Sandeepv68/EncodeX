/**
 * @fileoverview Unit tests for the first-run Getting Started card.
 * Verifies first-run visibility gating, navigation on goal selection, and
 * permanent dismissal after skip/choice (localStorage flag).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import GettingStartedCard from '../GettingStartedCard';

const ONBOARDING_STORAGE_KEY = 'encodex-onboarding-completed';

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderCard() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <GettingStartedCard />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('GettingStartedCard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows on first launch (flag absent)', () => {
    renderCard();
    expect(screen.getByTestId('getting-started-card')).toBeInTheDocument();
  });

  it('renders all four goal chips', () => {
    renderCard();
    for (const goal of ['convert', 'compress', 'extract', 'trim']) {
      expect(screen.getByTestId(`getting-started-goal-${goal}`)).toBeInTheDocument();
    }
  });

  it('navigates to the matching tool when a goal is chosen and hides the card', () => {
    renderCard();
    fireEvent.click(screen.getByTestId('getting-started-goal-extract'));
    expect(screen.getByTestId('location')).toHaveTextContent('/audio-extract');
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe('true');
    expect(screen.queryByTestId('getting-started-card')).not.toBeInTheDocument();
  });

  it('does not reappear on a second render once completed (flag set)', () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    renderCard();
    expect(screen.queryByTestId('getting-started-card')).not.toBeInTheDocument();
  });

  it('dismiss (X) hides it permanently without navigating', () => {
    renderCard();
    fireEvent.click(screen.getByTestId('getting-started-dismiss'));
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe('true');
    expect(screen.getByTestId('location')).toHaveTextContent('/');
    expect(screen.queryByTestId('getting-started-card')).not.toBeInTheDocument();
  });
});
