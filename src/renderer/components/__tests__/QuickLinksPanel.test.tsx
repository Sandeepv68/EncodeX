import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QuickLinksPanel from '../QuickLinksPanel';

const testFlags = vi.hoisted(() => ({ automations_page: true }));

vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ automations_page: testFlags.automations_page }),
}));

function renderPanel() {
  return render(
    <MemoryRouter>
      <QuickLinksPanel />
    </MemoryRouter>,
  );
}

describe('QuickLinksPanel', () => {
  beforeEach(() => {
    testFlags.automations_page = true;
  });

  it('renders a left-aligned panel heading without tabs or an empty-state card', () => {
    renderPanel();
    const heading = screen.getByRole('heading', { level: 2, name: 'quickLinks.title' });
    expect(screen.getByTestId('quick-links-panel')).toBeInTheDocument();
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveStyle({ textAlign: 'left' });
    expect(screen.queryByTestId('quick-links-tab-all')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quick-links-empty')).not.toBeInTheDocument();
  });

  it('renders every approved quick link as a titled, described, icon-based card', () => {
    const { container } = renderPanel();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(63);
    expect(container.querySelectorAll('svg')).toHaveLength(63);
    expect(screen.getByTestId('quick-link-chat-with-copilot')).toBeInTheDocument();
    expect(screen.getByTestId('quick-link-read-about-encodex')).toBeInTheDocument();
    expect(screen.getByText('quickLinks.links.chatWithCopilot.title')).toBeInTheDocument();
    expect(screen.getByText('quickLinks.links.chatWithCopilot.description')).toBeInTheDocument();
    expect(screen.queryByTestId('quick-link-/')).not.toBeInTheDocument();
  });

  it('hides automation quick links when automations_page is disabled', () => {
    testFlags.automations_page = false;
    renderPanel();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(59);
    expect(screen.queryByTestId('quick-link-build-automation')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quick-link-run-automation')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quick-link-view-run-history')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quick-link-save-automation-pipeline')).not.toBeInTheDocument();
  });
});
