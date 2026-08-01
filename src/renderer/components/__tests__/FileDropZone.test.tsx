import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FileDropZone from '../FileDropZone';

const selectFileMock = vi.mocked(window.electronAPI.selectFile);
const getPathForFileMock = vi.mocked(window.electronAPI.getPathForFile);

describe('FileDropZone', () => {
  beforeEach(() => {
    selectFileMock.mockReset();
    getPathForFileMock.mockReset();
  });

  it('renders the default label when none is provided', () => {
    render(<FileDropZone onFileSelect={() => {}} />);
    expect(screen.getByText('fileDropZone.defaultLabel')).toBeInTheDocument();
  });

  it('renders a custom label', () => {
    render(<FileDropZone onFileSelect={() => {}} label="Choose a file" />);
    expect(screen.getByText('Choose a file')).toBeInTheDocument();
  });

  it('opens the file dialog and reports the selected file on click', async () => {
    selectFileMock.mockResolvedValue('/selected/file.mp4');
    const onFileSelect = vi.fn();
    render(<FileDropZone onFileSelect={onFileSelect} />);
    fireEvent.click(screen.getByText('fileDropZone.defaultLabel'));
    await waitFor(() => expect(onFileSelect).toHaveBeenCalledWith('/selected/file.mp4'));
  });

  it('passes parsed extensions to the file dialog', async () => {
    selectFileMock.mockResolvedValue('/selected/file.mp4');
    const onFileSelect = vi.fn();
    render(<FileDropZone onFileSelect={onFileSelect} accept=".mp4, .avi" />);
    fireEvent.click(screen.getByText('fileDropZone.defaultLabel'));
    await waitFor(() => expect(onFileSelect).toHaveBeenCalled());
    expect(selectFileMock).toHaveBeenCalledWith([{ name: 'Files', extensions: ['.mp4', '.avi'] }]);
  });

  it('does nothing when the dialog is cancelled', async () => {
    selectFileMock.mockResolvedValue(null);
    const onFileSelect = vi.fn();
    render(<FileDropZone onFileSelect={onFileSelect} />);
    fireEvent.click(screen.getByText('fileDropZone.defaultLabel'));
    await waitFor(() => expect(selectFileMock).toHaveBeenCalled());
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it('reports the dropped file path', () => {
    getPathForFileMock.mockReturnValue('/dropped/file.mp4');
    const onFileSelect = vi.fn();
    render(<FileDropZone onFileSelect={onFileSelect} />);
    const zone = screen.getByText('fileDropZone.defaultLabel').parentElement!;
    const file = new File(['data'], 'photo.png');
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(getPathForFileMock).toHaveBeenCalledWith(file);
    expect(onFileSelect).toHaveBeenCalledWith('/dropped/file.mp4');
  });
});
