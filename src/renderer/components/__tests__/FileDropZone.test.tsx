import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileDropZone from '../FileDropZone';
import { assertNoAxeViolations } from '../../../test-utils/axe';

const selectFileMock = vi.mocked(window.electronAPI.selectFile);
const getPathForFileMock = vi.mocked(window.electronAPI.getPathForFile);

describe('FileDropZone', () => {
  beforeEach(() => {
    selectFileMock.mockReset();
    getPathForFileMock.mockReset();
  });

  it('has no axe violations', async () => {
    const { container } = render(<FileDropZone onFileSelect={() => {}} label="Choose a file" />);
    await assertNoAxeViolations(container);
  });

  it('renders the default label when none is provided', () => {
    render(<FileDropZone onFileSelect={() => {}} />);
    expect(screen.getByText('fileDropZone.defaultLabel')).toBeInTheDocument();
  });

  it('renders a custom label', () => {
    render(<FileDropZone onFileSelect={() => {}} label="Choose a file" />);
    expect(screen.getByText('Choose a file')).toBeInTheDocument();
  });

  it('renders a keyboard-activatable button with an accessible name', () => {
    render(<FileDropZone onFileSelect={() => {}} label="Choose a file" />);
    const zone = screen.getByTestId('file-drop-zone');
    expect(zone.tagName).toBe('BUTTON');
    expect(zone).toHaveAttribute('type', 'button');
    expect(zone).toHaveAccessibleName('Choose a file');
  });

  it('opens the file dialog and reports the selected file on click', async () => {
    selectFileMock.mockResolvedValue('/selected/file.mp4');
    const onFileSelect = vi.fn();
    render(<FileDropZone onFileSelect={onFileSelect} />);
    fireEvent.click(screen.getByText('fileDropZone.defaultLabel'));
    await waitFor(() => expect(onFileSelect).toHaveBeenCalledWith('/selected/file.mp4'));
  });

  it('opens the file dialog when activated with the Enter key', async () => {
    selectFileMock.mockResolvedValue('/selected/file.mp4');
    const onFileSelect = vi.fn();
    render(<FileDropZone onFileSelect={onFileSelect} />);
    const zone = screen.getByTestId('file-drop-zone');
    zone.focus();
    const user = userEvent.setup();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(onFileSelect).toHaveBeenCalledWith('/selected/file.mp4'));
  });

  it('opens the file dialog when activated with the Space key', async () => {
    selectFileMock.mockResolvedValue('/selected/file.mp4');
    const onFileSelect = vi.fn();
    render(<FileDropZone onFileSelect={onFileSelect} />);
    const zone = screen.getByTestId('file-drop-zone');
    zone.focus();
    const user = userEvent.setup();
    await user.keyboard(' ');
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
