import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import BatchEncodingPanel from '../BatchEncodingPanel';

function renderPanel(props: Partial<ComponentProps<typeof BatchEncodingPanel>> = {}) {
  const all: ComponentProps<typeof BatchEncodingPanel> = {
    operation: 'transcode',
    videoCodec: 'libx264',
    audioCodec: 'aac',
    container: '',
    videoBitrate: '',
    audioBitrate: '',
    quality: '',
    scale: '',
    pixelFormat: 'yuv420p',
    onVideoCodecChange: vi.fn(),
    onAudioCodecChange: vi.fn(),
    onContainerChange: vi.fn(),
    onVideoBitrateChange: vi.fn(),
    onAudioBitrateChange: vi.fn(),
    onQualityChange: vi.fn(),
    onScaleChange: vi.fn(),
    onPixelFormatChange: vi.fn(),
    ...props,
  };
  const utils = render(<BatchEncodingPanel {...all} />);
  return { props: all, ...utils };
}

describe('BatchEncodingPanel', () => {
  it('renders the encoding options title', () => {
    renderPanel();
    expect(screen.getByText('batchQueue.encodingOptions')).toBeInTheDocument();
  });

  it('renders all seven controls for the transcode operation', () => {
    renderPanel();
    expect(screen.getAllByRole('combobox')).toHaveLength(7);
    expect(screen.getByText('convert.videoBitrate')).toBeInTheDocument();
    expect(screen.getByText('convert.audioBitrate')).toBeInTheDocument();
    expect(screen.getByText('convert.scale')).toBeInTheDocument();
    expect(screen.getByText('yuv420p')).toBeInTheDocument();
  });

  it('lists the container options compatible with the selected video codec', () => {
    renderPanel();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[2]);
    expect(screen.getByText('batchQueue.containerAuto')).toBeInTheDocument();
    expect(screen.getByText('mp4')).toBeInTheDocument();
    expect(screen.getByText('mkv')).toBeInTheDocument();
    expect(screen.queryByText('webm')).not.toBeInTheDocument();
  });

  it('fires onContainerChange when a container is chosen', () => {
    const { props } = renderPanel();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[2]);
    fireEvent.click(screen.getByText('mkv'));
    expect(props.onContainerChange).toHaveBeenCalledWith('mkv');
  });

  it('fires onVideoCodecChange when a video codec is chosen', () => {
    const { props } = renderPanel();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(screen.getByText('Theora (libtheora)'));
    expect(props.onVideoCodecChange).toHaveBeenCalledWith('libtheora');
  });

  it('renders only audio controls for the extract audio operation', () => {
    renderPanel({ operation: 'extract_audio' });
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
    expect(screen.getByText('convert.audioBitrate')).toBeInTheDocument();
    expect(screen.queryByText('convert.videoBitrate')).not.toBeInTheDocument();
    expect(screen.queryByText('convert.scale')).not.toBeInTheDocument();
  });

  it('renders image controls for the compress image operation', () => {
    renderPanel({ operation: 'compress_image' });
    expect(screen.getByText('imageCompress.outputFormat')).toBeInTheDocument();
    expect(screen.getByText('imageCompress.quality')).toBeInTheDocument();
    expect(screen.getByText('imageCompress.scale')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(screen.queryByText('convert.videoCodec')).not.toBeInTheDocument();
    expect(screen.queryByText('convert.audioCodec')).not.toBeInTheDocument();
  });

  it('fires onQualityChange when the compress image quality changes', () => {
    const { props } = renderPanel({ operation: 'compress_image' });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '20' } });
    expect(props.onQualityChange).toHaveBeenCalledWith('20');
  });

  it('lists the image formats for the compress image operation', () => {
    renderPanel({ operation: 'compress_image' });
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    expect(screen.getByText('batchQueue.containerAuto')).toBeInTheDocument();
    expect(screen.getByText('JPEG')).toBeInTheDocument();
    expect(screen.getByText('WebP')).toBeInTheDocument();
  });
});
