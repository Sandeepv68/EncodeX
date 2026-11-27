import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QuickLinksPanel from '../QuickLinksPanel';

function renderPanel() {
  return render(
    <MemoryRouter>
      <QuickLinksPanel />
    </MemoryRouter>,
  );
}

describe('QuickLinksPanel', () => {
  it('renders the panel title, tabs and empty state without page chrome', () => {
    renderPanel();
    expect(screen.getByTestId('quick-links-panel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'quickLinks.title' })).toBeInTheDocument();
    expect(screen.getByTestId('quick-links-tab-all')).toBeInTheDocument();
    expect(screen.getByTestId('quick-links-empty')).toHaveTextContent('quickLinks.empty');
  });

  it('keeps the selected category in panel state', () => {
    renderPanel();
    expect(screen.getByTestId('quick-links-tab-all')).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByTestId('quick-links-tab-all'));
    expect(screen.getByTestId('quick-links-empty')).toBeInTheDocument();
  });
});
