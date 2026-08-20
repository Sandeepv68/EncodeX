import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useUpdateStore } from '../updateStore';

const checkForUpdatesMock = vi.mocked(window.electronAPI.checkForUpdates);
const downloadUpdateMock = vi.mocked(window.electronAPI.downloadUpdate);
const cancelDownloadMock = vi.mocked(window.electronAPI.cancelDownload);
const installUpdateMock = vi.mocked(window.electronAPI.installUpdate);
const openReleaseNotesMock = vi.mocked(window.electronAPI.openReleaseNotes);

describe('updateStore', () => {
  beforeEach(() => {
    useUpdateStore.setState({
      status: 'idle',
      info: null,
      progress: null,
      installerPath: null,
      errorMessage: null,
      dialogOpen: false,
    });
    vi.clearAllMocks();
  });

  it('starts with idle status', () => {
    expect(useUpdateStore.getState().status).toBe('idle');
    expect(useUpdateStore.getState().info).toBeNull();
  });

  it('checkForUpdates sets status to checking and invokes IPC', () => {
    useUpdateStore.getState().checkForUpdates();
    expect(useUpdateStore.getState().status).toBe('checking');
    expect(checkForUpdatesMock).toHaveBeenCalled();
  });

  it('checkForUpdates clears previous errorMessage and progress', () => {
    useUpdateStore.setState({ errorMessage: 'old error', progress: { percent: 50, transferred: 500, total: 1000 } });
    useUpdateStore.getState().checkForUpdates();
    expect(useUpdateStore.getState().errorMessage).toBeNull();
    expect(useUpdateStore.getState().progress).toBeNull();
  });

  it('downloadUpdate sets status to downloading and invokes IPC', () => {
    useUpdateStore.getState().downloadUpdate();
    expect(useUpdateStore.getState().status).toBe('downloading');
    expect(downloadUpdateMock).toHaveBeenCalled();
  });

  it('downloadUpdate clears previous errorMessage and progress', () => {
    useUpdateStore.setState({ errorMessage: 'old', progress: { percent: 10, transferred: 100, total: 1000 } });
    useUpdateStore.getState().downloadUpdate();
    expect(useUpdateStore.getState().errorMessage).toBeNull();
    expect(useUpdateStore.getState().progress).toBeNull();
  });

  it('cancelDownload reverts to available and invokes IPC', () => {
    useUpdateStore.setState({ status: 'downloading' });
    useUpdateStore.getState().cancelDownload();
    expect(useUpdateStore.getState().status).toBe('available');
    expect(useUpdateStore.getState().progress).toBeNull();
    expect(cancelDownloadMock).toHaveBeenCalled();
  });

  it('installUpdate invokes IPC with installerPath', () => {
    useUpdateStore.setState({ installerPath: '/tmp/app.exe' });
    useUpdateStore.getState().installUpdate();
    expect(installUpdateMock).toHaveBeenCalledWith('/tmp/app.exe');
  });

  it('installUpdate does nothing without installerPath', () => {
    useUpdateStore.setState({ installerPath: null });
    useUpdateStore.getState().installUpdate();
    expect(installUpdateMock).not.toHaveBeenCalled();
  });

  it('openReleaseNotes invokes IPC with url', () => {
    useUpdateStore.getState().openReleaseNotes('https://example.com');
    expect(openReleaseNotesMock).toHaveBeenCalledWith('https://example.com');
  });

  it('openDialog and closeDialog toggle dialogOpen', () => {
    expect(useUpdateStore.getState().dialogOpen).toBe(false);
    useUpdateStore.getState().openDialog();
    expect(useUpdateStore.getState().dialogOpen).toBe(true);
    useUpdateStore.getState().closeDialog();
    expect(useUpdateStore.getState().dialogOpen).toBe(false);
  });

  it('reset returns to idle state', () => {
    useUpdateStore.setState({
      status: 'available',
      info: { version: '2.0.0', releaseNotes: '', releaseUrl: '', asset: { name: 'a', url: '', size: 0 } },
      installerPath: '/tmp/app.exe',
      errorMessage: 'err',
    });
    useUpdateStore.getState().reset();
    expect(useUpdateStore.getState()).toMatchObject({
      status: 'idle',
      info: null,
      progress: null,
      installerPath: null,
      errorMessage: null,
    });
  });

  it('simulates UPDATE_AVAILABLE event via setState', () => {
    const info = { version: '2.0.0', releaseNotes: 'notes', releaseUrl: 'https://', asset: { name: 'a.exe', url: 'https://', size: 100 } };
    useUpdateStore.setState({ status: 'available', info, progress: null, errorMessage: null });
    expect(useUpdateStore.getState().status).toBe('available');
    expect(useUpdateStore.getState().info).toEqual(info);
  });

  it('simulates UPDATE_NOT_AVAILABLE event via setState', () => {
    useUpdateStore.setState({ status: 'not-available', errorMessage: null });
    expect(useUpdateStore.getState().status).toBe('not-available');
  });

  it('simulates UPDATE_PROGRESS event via setState', () => {
    useUpdateStore.setState({ progress: { percent: 50, transferred: 500, total: 1000 } });
    expect(useUpdateStore.getState().progress).toEqual({ percent: 50, transferred: 500, total: 1000 });
  });

  it('simulates UPDATE_DOWNLOADED event via setState', () => {
    useUpdateStore.setState({ status: 'downloaded', installerPath: '/tmp/update.exe', progress: null });
    expect(useUpdateStore.getState().status).toBe('downloaded');
    expect(useUpdateStore.getState().installerPath).toBe('/tmp/update.exe');
  });

  it('simulates UPDATE_ERROR event via setState', () => {
    useUpdateStore.setState({ status: 'error', errorMessage: 'network error', progress: null });
    expect(useUpdateStore.getState().status).toBe('error');
    expect(useUpdateStore.getState().errorMessage).toBe('network error');
  });
});
