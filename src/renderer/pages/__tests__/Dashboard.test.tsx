import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Dashboard from '../Dashboard';

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Dashboard />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('Dashboard', () => {
  it('renders the welcome title and subtitle', () => {
    renderDashboard();
    expect(screen.getByText('dashboard.welcome 👋')).toBeInTheDocument();
    expect(screen.getByText('dashboard.subtitle')).toBeInTheDocument();
  });

  it('renders a feature card for every nav route except home, logs, settings, and about', () => {
    renderDashboard();
    expect(screen.getByText('nav.convert')).toBeInTheDocument();
    expect(screen.getByText('nav.mediaInfo')).toBeInTheDocument();
    expect(screen.getByText('nav.image')).toBeInTheDocument();
    expect(screen.getByText('nav.audio')).toBeInTheDocument();
    expect(screen.getByText('nav.cut')).toBeInTheDocument();
    expect(screen.getByText('nav.batchQueue')).toBeInTheDocument();
    expect(screen.queryByText('nav.logs')).not.toBeInTheDocument();
    expect(screen.queryByText('nav.settings')).not.toBeInTheDocument();
    expect(screen.queryByText('nav.about')).not.toBeInTheDocument();
  });

  it('navigates to the feature page when a card is clicked', () => {
    renderDashboard();
    fireEvent.click(screen.getByText('nav.convert'));
    expect(screen.getByTestId('location')).toHaveTextContent('/convert');
  });

  it('navigates to the batch queue page when its card is clicked', () => {
    renderDashboard();
    fireEvent.click(screen.getByText('nav.batchQueue'));
    expect(screen.getByTestId('location')).toHaveTextContent('/batch');
  });

  it('renders the description text for each card', () => {
    renderDashboard();
    expect(screen.getByText('dashboard.descConvert')).toBeInTheDocument();
    expect(screen.getByText('dashboard.descBatch')).toBeInTheDocument();
  });

  it('navigates to the convert page when 1 is pressed', () => {
    renderDashboard();
    fireEvent.keyDown(window, { code: 'Digit1', key: '1' });
    expect(screen.getByTestId('location')).toHaveTextContent('/convert');
  });

  it('navigates to the audio extract page when 4 is pressed', () => {
    renderDashboard();
    fireEvent.keyDown(window, { code: 'Digit4', key: '4' });
    expect(screen.getByTestId('location')).toHaveTextContent('/audio-extract');
  });

  it('navigates to the batch queue page when 6 is pressed', () => {
    renderDashboard();
    fireEvent.keyDown(window, { code: 'Digit6', key: '6' });
    expect(screen.getByTestId('location')).toHaveTextContent('/batch');
  });

  it('renders the keyboard-shortcuts footer hint', () => {
    renderDashboard();
    expect(screen.getByTestId('dashboard-shortcuts-hint')).toHaveTextContent('dashboard.shortcutsFooter');
  });
});
