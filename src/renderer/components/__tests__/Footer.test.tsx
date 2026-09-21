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
      scheduledVersion: null,
      restartScheduled: false,
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

  it('shows a progress widget with percent text and cancel button while downloading', () => {
    useUpdateStore.setState({
      status: 'downloading',
      progress: { percent: 45, transferred: 460800, total: 1024000 },
      info: { version: '2.0.0', releaseNotes: '', releaseUrl: '', asset: { name: 'app.exe', url: '', size: 0 } },
    });
    render(<Footer />);
    expect(screen.getByTestId('footer-update-downloading')).toBeInTheDocument();
    expect(screen.getByText(/45%/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'update.cancelDownload' })).toBeInTheDocument();
  });

  it('cancels the download from the footer widget', () => {
    useUpdateStore.setState({
      status: 'downloading',
      progress: { percent: 10, transferred: 1024, total: 10240 },
    });
    render(<Footer />);
    fireEvent.click(screen.getByRole('button', { name: 'update.cancelDownload' }));
    expect(useUpdateStore.getState().status).toBe('available');
  });

  it('shows a ready-to-install banner with install actions when downloaded', () => {
    useUpdateStore.setState({
      status: 'downloaded',
      installerPath: '/tmp/app.exe',
      info: { version: '2.0.0', releaseNotes: '', releaseUrl: '', asset: { name: 'app.exe', url: '', size: 0 } },
    });
    render(<Footer />);
    expect(screen.getByTestId('footer-update-ready')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'update.installRestart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'update.installOnRestart' })).toBeInTheDocument();
  });

  it('shows a pending-install notice with cancel action when restart-scheduled', () => {
    useUpdateStore.setState({ status: 'restart-scheduled', scheduledVersion: '2.0.0' });
    render(<Footer />);
    expect(screen.getByTestId('footer-restart-scheduled')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'update.cancelRestartInstall' })).toBeInTheDocument();
  });

  it('cancels the scheduled restart install from the footer widget', () => {
    useUpdateStore.setState({ status: 'restart-scheduled', restartScheduled: true });
    render(<Footer />);
    fireEvent.click(screen.getByRole('button', { name: 'update.cancelRestartInstall' }));
    expect(useUpdateStore.getState().status).toBe('downloaded');
    expect(useUpdateStore.getState().restartScheduled).toBe(false);
  });

  it('shows a downloaded toast with a view action once', () => {
    const addToastSpy = vi.spyOn(useToastStore.getState(), 'addToast');
    useUpdateStore.setState({ status: 'idle' });
    const { rerender } = render(<Footer />);

    const updateInfo = { version: '2.0.0', releaseNotes: '', releaseUrl: '', asset: { name: 'app.exe', url: '', size: 0 } };
    useUpdateStore.setState({ status: 'downloaded', info: updateInfo, installerPath: '/tmp/app.exe' });
    rerender(<Footer />);

    useUpdateStore.setState({ status: 'downloaded', info: updateInfo, installerPath: '/tmp/app.exe' });
    rerender(<Footer />);

    expect(addToastSpy).toHaveBeenCalledTimes(1);
    expect(addToastSpy).toHaveBeenCalledWith(
      'info',
      'toast.updateDownloaded',
      undefined,
      10000,
      expect.objectContaining({ label: 'toast.viewUpdate' }),
    );
    addToastSpy.mockRestore();
  });
});
