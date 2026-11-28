import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import DashboardActionsRow from '../DashboardActionsRow';

describe('DashboardActionsRow', () => {
  it('uses one ghost icon button to toggle panels and shows a tooltip', async () => {
    const onToggleView = vi.fn();
    render(<DashboardActionsRow view="dashboard" onToggleView={onToggleView} />);

    const toggle = screen.getByTestId('dashboard-view-toggle-button');
    expect(toggle).toHaveTextContent('');
    expect(toggle).toHaveAttribute('aria-label', 'quickLinks.title');
    fireEvent.mouseOver(toggle);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('quickLinks.title');
    fireEvent.click(toggle);
    expect(onToggleView).toHaveBeenCalledOnce();
  });

  it('renders a ghost icon-only edit button with a tooltip only on the dashboard panel', async () => {
    const onToggleEdit = vi.fn();
    const { rerender } = render(<DashboardActionsRow view="quick-links" onToggleView={vi.fn()} onToggleEdit={onToggleEdit} />);
    expect(screen.queryByTestId('dashboard-edit-button')).not.toBeInTheDocument();

    rerender(<DashboardActionsRow view="dashboard" editing onToggleView={vi.fn()} onToggleEdit={onToggleEdit} />);
    const edit = screen.getByTestId('dashboard-edit-button');
    expect(edit).toHaveTextContent('');
    expect(edit).toHaveAttribute('aria-label', 'dashboard.edit.done');
    expect(edit).toHaveAttribute('aria-pressed', 'true');
    fireEvent.mouseOver(edit);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('dashboard.edit.done');
    fireEvent.click(edit);
    expect(onToggleEdit).toHaveBeenCalledOnce();
  });
});
