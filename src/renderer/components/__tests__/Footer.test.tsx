import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Footer from '../Footer';
import { useUpdateStore } from '../../stores/updateStore';
import { useToastStore } from '../../stores/toastStore';

vi.mock('../../stores/toastStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../stores/toastStore')>();
  return {
    ...actual,
    useToastStore: {
      ...actual.useToastStore,
      getState: vi.fn(() => actual.useToastStore.getState()),
    },
  };
});

describe('Footer', () => {
  beforeEach(() => {
    useUpdateStore.setState({
      status: 'idle',
      info: null,
      progress: null,
      installerPath: null,
      errorMessage: null,
      dialogOpen: false,
    });
    useToastStore.setState({ toasts: [] });
    vi.clearAllMocks();
  });

  it('renders the app name, version and powered-by line', () => {
    render(<Footer />);
    expect(screen.getByText(/app\.name/)).toBeInTheDocument();
    expect(screen.getByText(/footer\.version/)).toBeInTheDocument();
    expect(screen.getByText('footer.poweredBy')).toBeInTheDocument();
  });

  it('renders the FFmpeg banner image', () => {
    render(<Footer />);
    const img = screen.getByAltText('FFmpeg');
    expect(img).toBeInTheDocument();
  });

  it('shows checking indicator when status is checking', () => {
    useUpdateStore.setState({ status: 'checking' });
    render(<Footer />);
    expect(screen.getByText('footer.checkingForUpdates')).toBeInTheDocument();
    expect(screen.getByText('|')).toBeInTheDocument();
  });

  it('does not show checking indicator when status is idle', () => {
    useUpdateStore.setState({ status: 'idle' });
    render(<Footer />);
    expect(screen.queryByText('footer.checkingForUpdates')).not.toBeInTheDocument();
  });

  it('shows update available link when status is available', () => {
    useUpdateStore.setState({
      status: 'available',
      info: { version: '2.0.0', releaseNotes: '', releaseUrl: '', asset: { name: 'app.exe', url: '', size: 0 } },
    });
    render(<Footer />);
    expect(screen.getByText('footer.updateAvailable')).toBeInTheDocument();
    expect(screen.getByText('|')).toBeInTheDocument();
  });

  it('does not show update link when status is not-available', () => {
    useUpdateStore.setState({ status: 'not-available' });
    render(<Footer />);
    expect(screen.queryByText('footer.updateAvailable')).not.toBeInTheDocument();
  });

  it('opens update dialog when update link is clicked', () => {
    const openDialog = vi.fn();
    useUpdateStore.setState({
      status: 'available',
      info: { version: '2.0.0', releaseNotes: '', releaseUrl: '', asset: { name: 'app.exe', url: '', size: 0 } },
      openDialog,
    });
    render(<Footer />);
    fireEvent.click(screen.getByText('footer.updateAvailable'));
    expect(openDialog).toHaveBeenCalled();
  });

  it('shows toast when update becomes available', () => {
    const addToastSpy = vi.spyOn(useToastStore.getState(), 'addToast');
    useUpdateStore.setState({ status: 'idle' });
    const { rerender } = render(<Footer />);

    useUpdateStore.setState({
      status: 'available',
      info: { version: '2.0.0', releaseNotes: '', releaseUrl: '', asset: { name: 'app.exe', url: '', size: 0 } },
    });
    rerender(<Footer />);

    expect(addToastSpy).toHaveBeenCalledWith(
      'info',
      'toast.updateAvailable',
      undefined,
      8000,
      expect.objectContaining({ label: 'toast.updateNow' }),
    );
    addToastSpy.mockRestore();
  });

  it('only shows toast once for the same update', () => {
    const addToastSpy = vi.spyOn(useToastStore.getState(), 'addToast');
    useUpdateStore.setState({ status: 'idle' });
    const { rerender } = render(<Footer />);

    const updateInfo = { version: '2.0.0', releaseNotes: '', releaseUrl: '', asset: { name: 'app.exe', url: '', size: 0 } };
    useUpdateStore.setState({ status: 'available', info: updateInfo });
    rerender(<Footer />);

    useUpdateStore.setState({ status: 'available', info: updateInfo });
    rerender(<Footer />);

    expect(addToastSpy).toHaveBeenCalledTimes(1);
    addToastSpy.mockRestore();
  });
});
