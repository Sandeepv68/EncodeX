import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GlobalQueueOptions from '../GlobalQueueOptions';
import type { WhenDoneAction } from '../../../shared/types';
import { assertNoAxeViolations } from '../../../test-utils/axe';

function renderOptions(whenDone: WhenDoneAction) {
  const onWhenDoneChange = vi.fn();
  const renderResult = render(<GlobalQueueOptions whenDone={whenDone} onWhenDoneChange={onWhenDoneChange} />);
  return { renderResult, onWhenDoneChange };
}

describe('GlobalQueueOptions', () => {
  it('has no axe violations', async () => {
    const { renderResult } = renderOptions('shutdown');
    await assertNoAxeViolations(renderResult.container);
  });

  it('renders the selected action in the dropdown', () => {
    renderOptions('hibernate');
    expect(screen.getByRole('combobox', { name: 'batchQueue.whenDone' })).toHaveTextContent('batchQueue.whenDoneHibernate');
  });

  it('offers every action plus the none option', () => {
    renderOptions('none');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'batchQueue.whenDone' }));
    // "None" appears twice while the menu is open: once as the selected value
    // and once as the menu option.
    expect(screen.getAllByText('status.none').length).toBeGreaterThan(0);
    expect(screen.getByText('batchQueue.whenDoneSleep')).toBeInTheDocument();
    expect(screen.getByText('batchQueue.whenDoneHibernate')).toBeInTheDocument();
    expect(screen.getByText('batchQueue.whenDoneShutdown')).toBeInTheDocument();
    expect(screen.getByText('batchQueue.whenDoneShutdownForce')).toBeInTheDocument();
  });

  it('fires onWhenDoneChange with the chosen action', () => {
    const { onWhenDoneChange } = renderOptions('none');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'batchQueue.whenDone' }));
    fireEvent.click(screen.getByText('batchQueue.whenDoneSleep'));
    expect(onWhenDoneChange).toHaveBeenCalledWith('sleep');
  });

  it('fires onWhenDoneChange with shutdown_force for the force option', () => {
    const { onWhenDoneChange } = renderOptions('none');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'batchQueue.whenDone' }));
    fireEvent.click(screen.getByText('batchQueue.whenDoneShutdownForce'));
    expect(onWhenDoneChange).toHaveBeenCalledWith('shutdown_force');
  });
});
