import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GlobalQueueOptions from '../GlobalQueueOptions';
import type { WhenDoneAction } from '../../../shared/types';
import { assertNoAxeViolations } from '../../../test-utils/axe';

function renderOptions(whenDone: WhenDoneAction) {
  const onWhenDoneChange = vi.fn();
  const renderResult = render(<GlobalQueueOptions whenDone={whenDone} onWhenDoneChange={onWhenDoneChange} />);
  return { renderResult, onWhenDoneChange };
}

/**
 * Expands the collapsed action button and waits for the dropdown menu.
 * @returns {Promise<HTMLElement>} The opened listbox.
 */
async function openMenu(): Promise<HTMLElement> {
  fireEvent.click(screen.getByTestId('when-done-button'));
  return screen.findByRole('listbox');
}

describe('GlobalQueueOptions', () => {
  it('has no axe violations', async () => {
    const { renderResult } = renderOptions('shutdown');
    await assertNoAxeViolations(renderResult.container);
  });

  it('renders the collapsed action button with the selected action icon and label', () => {
    renderOptions('hibernate');
    const button = screen.getByTestId('when-done-button');
    expect(button).toHaveAttribute('aria-label', 'batchQueue.whenDone: batchQueue.whenDoneHibernate');
    expect(button.querySelector('[data-icon]')).toHaveAttribute('data-icon', 'snowflake');
    const label = screen.getByText('batchQueue.whenDone', { selector: 'label' });
    expect(label).toHaveAttribute('for', 'global-when-done-action');
    expect(label).toHaveStyle({ visibility: 'hidden' });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('expands into the dropdown showing the selected action', async () => {
    renderOptions('sleep');
    await openMenu();
    // The open menu marks the rest of the page as aria-hidden, so the field is
    // only reachable through the hidden-inclusive role query.
    const combobox = screen.getByRole('combobox', { name: 'batchQueue.whenDone', hidden: true });
    expect(combobox).toHaveTextContent('batchQueue.whenDoneSleep');
    expect(screen.getByText('batchQueue.whenDone', { selector: 'label' })).toHaveStyle({
      visibility: 'visible',
    });
    expect(screen.queryByTestId('when-done-button')).not.toBeInTheDocument();
  });

  it('offers every action plus the none option, each with a matching icon', async () => {
    renderOptions('none');
    await openMenu();
    const expectedIcons: Record<WhenDoneAction, string> = {
      none: 'toggle-off',
      sleep: 'moon',
      hibernate: 'snowflake',
      shutdown: 'power-off',
      shutdown_force: 'plug-circle-xmark',
    };
    for (const [action, icon] of Object.entries(expectedIcons)) {
      const option = screen.getByTestId(`when-done-option-${action}`);
      expect(option.querySelector('[data-icon]')).toHaveAttribute('data-icon', icon);
    }
    expect(screen.getByText('batchQueue.whenDoneSleep')).toBeInTheDocument();
    expect(screen.getByText('batchQueue.whenDoneHibernate')).toBeInTheDocument();
    expect(screen.getByText('batchQueue.whenDoneShutdown')).toBeInTheDocument();
    expect(screen.getByText('batchQueue.whenDoneShutdownForce')).toBeInTheDocument();
  });

  it('collapses back to the button and fires onWhenDoneChange with the chosen action', async () => {
    const { onWhenDoneChange } = renderOptions('none');
    await openMenu();
    fireEvent.click(screen.getByText('batchQueue.whenDoneSleep'));
    expect(onWhenDoneChange).toHaveBeenCalledWith('sleep');
    expect(await screen.findByTestId('when-done-button')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
  });

  it('fires onWhenDoneChange with shutdown_force for the force option', async () => {
    const { onWhenDoneChange } = renderOptions('none');
    await openMenu();
    fireEvent.click(screen.getByText('batchQueue.whenDoneShutdownForce'));
    expect(onWhenDoneChange).toHaveBeenCalledWith('shutdown_force');
  });
});
