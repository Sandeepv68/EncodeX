/**
 * @fileoverview Unit tests for the first-run Getting Started card.
 * Verifies first-run visibility gating, navigation on goal selection, permanent
 * dismissal after skip/choice (localStorage flag), and the two setup actions
 * (Enable MCP server / Connect your AI providers) sharing the card's single
 * button style.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import GettingStartedCard from '../GettingStartedCard';
import { useSettingsStore } from '../../stores/settingsStore';
import { useToastStore } from '../../stores/toastStore';

const ONBOARDING_STORAGE_KEY = 'encodex-onboarding-completed';

const GOALS = ['convert', 'compress', 'extract', 'trim', 'remux', 'copilot'];

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
    useSettingsStore.setState({ mcpEnabled: false });
    useToastStore.setState({ toasts: [] });
  });

  it('shows on first launch (flag absent)', () => {
    renderCard();
    expect(screen.getByTestId('getting-started-card')).toBeInTheDocument();
  });

  it('renders all six goal buttons', () => {
    renderCard();
    for (const goal of GOALS) {
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

  it('renders the MCP and AI-provider setup buttons', () => {
    renderCard();
    expect(screen.getByTestId('getting-started-enable-mcp')).toBeInTheDocument();
    expect(screen.getByTestId('getting-started-connect-ai-providers')).toBeInTheDocument();
  });

  it('gives every action the same button style', () => {
    renderCard();
    const buttons = [
      ...GOALS.map((goal) => screen.getByTestId(`getting-started-goal-${goal}`)),
      screen.getByTestId('getting-started-enable-mcp'),
      screen.getByTestId('getting-started-connect-ai-providers'),
    ];
    for (const button of buttons) {
      expect(button.className).toContain('MuiButton-outlined');
    }
  });

  it('keeps every action in a single row', () => {
    renderCard();
    const buttons = [
      ...GOALS.map((goal) => screen.getByTestId(`getting-started-goal-${goal}`)),
      screen.getByTestId('getting-started-enable-mcp'),
      screen.getByTestId('getting-started-connect-ai-providers'),
    ];
    const rows = new Set(buttons.map((button) => button.parentElement));
    expect(rows.size).toBe(1);
  });

  it('keeps the Enable MCP server button active even when the server is already on', () => {
    useSettingsStore.setState({ mcpEnabled: true });
    renderCard();
    const button = screen.getByTestId('getting-started-enable-mcp');
    expect(button).toBeEnabled();
  });

  it('leaves the MCP server disabled until the user opts in', async () => {
    renderCard();
    expect(useSettingsStore.getState().mcpEnabled).toBe(false);
    fireEvent.click(screen.getByTestId('getting-started-enable-mcp'));
    await waitFor(() => expect(useSettingsStore.getState().mcpEnabled).toBe(true));
  });

  it('navigates to the AI provider settings without resolving onboarding', () => {
    renderCard();
    fireEvent.click(screen.getByTestId('getting-started-connect-ai-providers'));
    expect(screen.getByTestId('location')).toHaveTextContent('/settings');
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull();
  });
});
