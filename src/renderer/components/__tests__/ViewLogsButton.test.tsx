import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ViewLogsButton from '../ViewLogsButton';

const openLogsWindowMock = vi.mocked(window.electronAPI.openLogsWindow);

describe('ViewLogsButton', () => {
  beforeEach(() => {
    openLogsWindowMock.mockReset();
  });

  it('opens the detached logs window from the labelled action', () => {
    render(<ViewLogsButton />);

    fireEvent.click(screen.getByRole('button', { name: 'logs.viewLogs' }));

    expect(openLogsWindowMock).toHaveBeenCalledOnce();
  });

  it('renders a compact icon action with the same accessible name', () => {
    render(<ViewLogsButton iconOnly />);

    const button = screen.getByRole('button', { name: 'logs.viewLogs' });
    expect(button).toHaveAttribute('data-testid', 'view-logs');

    fireEvent.click(button);
    expect(openLogsWindowMock).toHaveBeenCalledOnce();
  });
});
