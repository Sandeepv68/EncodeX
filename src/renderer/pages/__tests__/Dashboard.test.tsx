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
    expect(screen.getByText('dashboard.welcome')).toBeInTheDocument();
    expect(screen.getByText('dashboard.subtitle')).toBeInTheDocument();
  });

  it('renders a feature card for every nav route except home, logs, and settings', () => {
    renderDashboard();
    expect(screen.getByText('nav.convert')).toBeInTheDocument();
    expect(screen.getByText('nav.mediaInfo')).toBeInTheDocument();
    expect(screen.getByText('nav.image')).toBeInTheDocument();
    expect(screen.getByText('nav.audio')).toBeInTheDocument();
    expect(screen.getByText('nav.cut')).toBeInTheDocument();
    expect(screen.getByText('nav.batchQueue')).toBeInTheDocument();
    expect(screen.queryByText('nav.logs')).not.toBeInTheDocument();
    expect(screen.queryByText('nav.settings')).not.toBeInTheDocument();
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
});
