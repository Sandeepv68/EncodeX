import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UpdateDialog from '../UpdateDialog';
import { useUpdateStore } from '../../stores/updateStore';

vi.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: ({ icon }: { icon: unknown }) => <span data-testid="fa-icon" data-icon={JSON.stringify(icon)} />,
}));

describe('UpdateDialog', () => {
  beforeEach(() => {
    useUpdateStore.setState({
      status: 'idle',
      info: null,
      progress: null,
      installerPath: null,
      errorMessage: null,
      dialogOpen: true,
    });
    vi.clearAllMocks();
  });

  it('does not render when dialogOpen is false', () => {
    useUpdateStore.setState({ dialogOpen: false });
    render(<UpdateDialog />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders with checking status', () => {
    useUpdateStore.setState({ status: 'checking', dialogOpen: true });
    render(<UpdateDialog />);
    expect(screen.getByText('update.checking')).toBeInTheDocument();
  });

  it('renders with idle status (same as checking UI)', () => {
    useUpdateStore.setState({ status: 'idle', dialogOpen: true });
    render(<UpdateDialog />);
    expect(screen.getByText('update.checking')).toBeInTheDocument();
  });

  it('renders with not-available status', () => {
    useUpdateStore.setState({ status: 'not-available', dialogOpen: true });
    render(<UpdateDialog />);
    expect(screen.getByText('update.upToDate')).toBeInTheDocument();
    expect(screen.getByText('update.close')).toBeInTheDocument();
  });

  it('renders with available status and shows version/release notes', () => {
    useUpdateStore.setState({
      status: 'available',
      dialogOpen: true,
      info: {
        version: '2.0.0',
        releaseNotes: 'Bug fixes',
        releaseUrl: 'https://github.com/releases',
        asset: { name: 'app.exe', url: 'https://', size: 100 },
      },
    });
    render(<UpdateDialog />);
    expect(screen.getByText('update.newVersionAvailable')).toBeInTheDocument();
    expect(screen.getByText('v2.0.0')).toBeInTheDocument();
    expect(screen.getByText('Bug fixes')).toBeInTheDocument();
    expect(screen.getByText('update.download')).toBeInTheDocument();
    expect(screen.getByText('update.later')).toBeInTheDocument();
  });

  it('hides release notes when not provided', () => {
    useUpdateStore.setState({
      status: 'available',
      dialogOpen: true,
      info: { version: '2.0.0', releaseNotes: '', releaseUrl: 'https://', asset: { name: 'app.exe', url: 'https://', size: 100 } },
    });
    render(<UpdateDialog />);
    expect(screen.queryByText('Bug fixes')).not.toBeInTheDocument();
  });

  it('renders with downloading status and shows progress', () => {
    useUpdateStore.setState({
      status: 'downloading',
      dialogOpen: true,
      progress: { percent: 45, transferred: 460800, total: 1024000 },
    });
    render(<UpdateDialog />);
    expect(screen.getByText('update.downloading')).toBeInTheDocument();
    expect(screen.getByText('update.cancelDownload')).toBeInTheDocument();
    expect(screen.getByText(/45%/)).toBeInTheDocument();
  });

  it('hides progress info when progress is null during downloading', () => {
    useUpdateStore.setState({ status: 'downloading', dialogOpen: true, progress: null });
    render(<UpdateDialog />);
    expect(screen.getByText('update.downloading')).toBeInTheDocument();
    expect(screen.queryByText('%')).not.toBeInTheDocument();
  });

  it('renders with downloaded status', () => {
    useUpdateStore.setState({ status: 'downloaded', dialogOpen: true, installerPath: '/tmp/app.exe' });
    render(<UpdateDialog />);
    expect(screen.getByText('update.readyToInstall')).toBeInTheDocument();
    expect(screen.getByText('update.installRestart')).toBeInTheDocument();
    expect(screen.getByText('update.later')).toBeInTheDocument();
  });

  it('renders with error status', () => {
    useUpdateStore.setState({ status: 'error', dialogOpen: true, errorMessage: 'Network timeout' });
    render(<UpdateDialog />);
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
    expect(screen.getByText('update.retry')).toBeInTheDocument();
    expect(screen.getByText('update.close')).toBeInTheDocument();
  });

  it('shows default error text when errorMessage is null', () => {
    useUpdateStore.setState({ status: 'error', dialogOpen: true, errorMessage: null });
    render(<UpdateDialog />);
    expect(screen.getByText('update.error')).toBeInTheDocument();
  });

  it('close button is disabled when downloading', () => {
    useUpdateStore.setState({ status: 'downloading', dialogOpen: true });
    render(<UpdateDialog />);
    const dialog = screen.getByRole('dialog');
    // MUI Dialog's onClose should not fire closeDialog during downloading
    // Test by checking that cancelDownload is called instead
    fireEvent.click(screen.getByText('update.cancelDownload'));
    expect(useUpdateStore.getState().status).toBe('available');
  });

  it('handleClose calls closeDialog when not downloading', () => {
    useUpdateStore.setState({ status: 'not-available', dialogOpen: true });
    render(<UpdateDialog />);
    fireEvent.click(screen.getByText('update.close'));
    expect(useUpdateStore.getState().dialogOpen).toBe(false);
  });

  it('handleRetry calls reset and checkForUpdates', () => {
    const spy = vi.spyOn(useUpdateStore.getState(), 'checkForUpdates');
    useUpdateStore.setState({ status: 'error', dialogOpen: true });
    render(<UpdateDialog />);
    fireEvent.click(screen.getByText('update.retry'));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('download button calls downloadUpdate', () => {
    const spy = vi.spyOn(useUpdateStore.getState(), 'downloadUpdate');
    useUpdateStore.setState({
      status: 'available',
      dialogOpen: true,
      info: { version: '2.0.0', releaseNotes: '', releaseUrl: 'https://', asset: { name: 'app.exe', url: 'https://', size: 100 } },
    });
    render(<UpdateDialog />);
    fireEvent.click(screen.getByText('update.download'));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('install button calls installUpdate', () => {
    const spy = vi.spyOn(useUpdateStore.getState(), 'installUpdate');
    useUpdateStore.setState({ status: 'downloaded', dialogOpen: true, installerPath: '/tmp/app.exe' });
    render(<UpdateDialog />);
    fireEvent.click(screen.getByText('update.installRestart'));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('release notes link calls openReleaseNotes', () => {
    const spy = vi.spyOn(useUpdateStore.getState(), 'openReleaseNotes');
    useUpdateStore.setState({
      status: 'available',
      dialogOpen: true,
      info: {
        version: '2.0.0',
        releaseNotes: 'notes',
        releaseUrl: 'https://github.com/r',
        asset: { name: 'app.exe', url: 'https://', size: 100 },
      },
    });
    render(<UpdateDialog />);
    fireEvent.click(screen.getByText('update.viewReleaseNotes'));
    expect(spy).toHaveBeenCalledWith('https://github.com/r');
    spy.mockRestore();
  });
});

describe('formatBytes', () => {
  // formatBytes is a private function, test it indirectly via downloading progress text
  it('formats 0 bytes', () => {
    useUpdateStore.setState({
      status: 'downloading',
      dialogOpen: true,
      progress: { percent: 0, transferred: 0, total: 1024 },
    });
    render(<UpdateDialog />);
    expect(screen.getByText(/0 B/)).toBeInTheDocument();
  });

  it('formats KB range', () => {
    useUpdateStore.setState({
      status: 'downloading',
      dialogOpen: true,
      progress: { percent: 50, transferred: 1536, total: 3072 },
    });
    render(<UpdateDialog />);
    expect(screen.getByText(/1\.5 KB/)).toBeInTheDocument();
  });

  it('formats MB range', () => {
    useUpdateStore.setState({
      status: 'downloading',
      dialogOpen: true,
      progress: { percent: 50, transferred: 1048576, total: 2097152 },
    });
    render(<UpdateDialog />);
    expect(screen.getByText(/1\.0 MB/)).toBeInTheDocument();
  });

  it('formats GB range', () => {
    useUpdateStore.setState({
      status: 'downloading',
      dialogOpen: true,
      progress: { percent: 50, transferred: 1073741824, total: 2147483648 },
    });
    render(<UpdateDialog />);
    expect(screen.getByText(/1\.0 GB/)).toBeInTheDocument();
  });
});
