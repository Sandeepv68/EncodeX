import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CodecSelect from '../CodecSelect';
import { resetCapabilitiesCache } from '../../hooks/useCapabilities';

function mockCapabilities(videoEncoders: string[], audioEncoders: string[]) {
  vi.mocked(window.electronAPI.getCapabilities).mockResolvedValue({ videoEncoders, audioEncoders, hwaccels: [] });
}

describe('CodecSelect', () => {
  beforeEach(() => {
    resetCapabilitiesCache();
    vi.mocked(window.electronAPI.getCapabilities).mockResolvedValue(null);
  });

  it('shows video codecs for video type', async () => {
    render(<CodecSelect type="video" value="libx264" onChange={() => {}} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(await screen.findByRole('option', { name: 'H.264 (libx264)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'AAC (native)' })).not.toBeInTheDocument();
  });

  it('shows audio codecs for audio type', async () => {
    render(<CodecSelect type="audio" value="aac" onChange={() => {}} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(await screen.findByRole('option', { name: 'AAC (native)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'H.264 (libx264)' })).not.toBeInTheDocument();
  });

  it('reports the selected video codec', async () => {
    const onChange = vi.fn();
    render(<CodecSelect type="video" value="libx264" onChange={onChange} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const option = await screen.findByRole('option', { name: 'H.265/HEVC (libx265)' });
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith('libx265');
  });

  it('reports the selected audio codec', async () => {
    const onChange = vi.fn();
    render(<CodecSelect type="audio" value="aac" onChange={onChange} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const option = await screen.findByRole('option', { name: 'MP3 (LAME)' });
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith('libmp3lame');
  });

  it('filters video codecs down to the encoders the bundled ffmpeg provides', async () => {
    mockCapabilities(['libx264', 'h264_nvenc'], ['aac']);
    render(<CodecSelect type="video" value="libx264" onChange={() => {}} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(await screen.findByRole('option', { name: 'H.264 (libx264)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'H.264 (NVENC)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'H.265/HEVC (libx265)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'H.265 (QSV)' })).not.toBeInTheDocument();
  });

  it('filters audio codecs down to the encoders the bundled ffmpeg provides', async () => {
    mockCapabilities(['libx264'], ['aac', 'libmp3lame']);
    render(<CodecSelect type="audio" value="aac" onChange={() => {}} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(await screen.findByRole('option', { name: 'AAC (native)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'MP3 (LAME)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'AAC (FDK)' })).not.toBeInTheDocument();
  });

  it('keeps the current value visible even when the bundled ffmpeg lacks it', async () => {
    mockCapabilities(['libx264'], ['aac']);
    render(<CodecSelect type="video" value="hevc_nvenc" onChange={() => {}} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(await screen.findByRole('option', { name: 'H.264 (libx264)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'hevc_nvenc' })).toBeInTheDocument();
  });

  it('shows only hardware video codecs when encoderType is hardware', async () => {
    mockCapabilities(['libx264', 'h264_nvenc', 'hevc_qsv'], ['aac']);
    render(<CodecSelect type="video" value="h264_nvenc" onChange={() => {}} encoderType="hardware" />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(await screen.findByRole('option', { name: 'H.264 (NVENC)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'H.265 (QSV)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'H.264 (libx264)' })).not.toBeInTheDocument();
  });

  it('shows only software video codecs when encoderType is software', async () => {
    mockCapabilities(['libx264', 'h264_nvenc', 'hevc_qsv'], ['aac']);
    render(<CodecSelect type="video" value="libx264" onChange={() => {}} encoderType="software" />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(await screen.findByRole('option', { name: 'H.264 (libx264)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'H.264 (NVENC)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'H.265 (QSV)' })).not.toBeInTheDocument();
  });

  it('keeps the current value visible even when it is filtered out', async () => {
    mockCapabilities(['libx264', 'h264_nvenc'], ['aac']);
    render(<CodecSelect type="video" value="h264_nvenc" onChange={() => {}} encoderType="software" />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(await screen.findByRole('option', { name: 'H.264 (libx264)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'h264_nvenc' })).toBeInTheDocument();
  });

  it('does not filter audio codecs by encoder type', async () => {
    mockCapabilities(['libx264', 'h264_nvenc'], ['aac', 'libmp3lame']);
    render(<CodecSelect type="audio" value="aac" onChange={() => {}} encoderType="hardware" />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(await screen.findByRole('option', { name: 'AAC (native)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'MP3 (LAME)' })).toBeInTheDocument();
  });
});
