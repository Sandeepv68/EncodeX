import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import pkg from '../../../../package.json';
import TitleBar from '../TitleBar';

const api = window.electronAPI as unknown as {
  windowMinimize: ReturnType<typeof vi.fn>;
  windowMaximizeToggle: ReturnType<typeof vi.fn>;
  windowClose: ReturnType<typeof vi.fn>;
  onWindowMaximizedChange: ReturnType<typeof vi.fn>;
};

const isPrerelease = (version: string): boolean => /^[0-9]+\.[0-9]+\.[0-9]+(-|$)/.test(version) && version.includes('-');

describe('TitleBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the app name', () => {
    render(<TitleBar />);
    expect(screen.getByText('EncodeX')).toBeInTheDocument();
  });

  it('shows the Beta badge only for pre-release versions', () => {
    render(<TitleBar />);
    if (isPrerelease(pkg.version)) {
      expect(screen.getByText('Beta')).toBeInTheDocument();
    } else {
      expect(screen.queryByText('Beta')).not.toBeInTheDocument();
    }
  });

  it('minimizes the window when the minimize button is clicked', () => {
    render(<TitleBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Minimize' }));
    expect(api.windowMinimize).toHaveBeenCalledOnce();
  });

  it('toggles maximize when the maximize button is clicked', () => {
    render(<TitleBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Maximize' }));
    expect(api.windowMaximizeToggle).toHaveBeenCalledOnce();
  });

  it('closes the window when the close button is clicked', () => {
    render(<TitleBar />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(api.windowClose).toHaveBeenCalledOnce();
  });

  it('switches to the restore button when the window becomes maximized', () => {
    render(<TitleBar />);
    const subscribe = api.onWindowMaximizedChange;
    const cb = subscribe.mock.calls[0][0];
    act(() => {
      cb(true);
    });
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
  });
});
