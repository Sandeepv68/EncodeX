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
    scale: '',
    pixelFormat: 'yuv420p',
    onVideoCodecChange: vi.fn(),
    onAudioCodecChange: vi.fn(),
    onContainerChange: vi.fn(),
    onVideoBitrateChange: vi.fn(),
    onAudioBitrateChange: vi.fn(),
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
    expect(screen.getByRole('combobox', { name: 'convert.videoBitrate' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'convert.audioBitrate' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'convert.scale' })).toBeInTheDocument();
    expect(screen.getByText('yuv420p')).toBeInTheDocument();
  });

  it('lists the container options compatible with the selected video codec', () => {
    renderPanel();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'batchQueue.container' }));
    expect(screen.getByText('batchQueue.containerAuto')).toBeInTheDocument();
    expect(screen.getByText('mp4')).toBeInTheDocument();
    expect(screen.getByText('mkv')).toBeInTheDocument();
    expect(screen.queryByText('webm')).not.toBeInTheDocument();
  });

  it('fires onContainerChange when a container is chosen', () => {
    const { props } = renderPanel();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'batchQueue.container' }));
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
    expect(screen.getByRole('combobox', { name: 'convert.audioBitrate' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'convert.videoBitrate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'convert.scale' })).not.toBeInTheDocument();
  });

  it('renders nothing for the compress image operation', () => {
    const { container } = renderPanel({ operation: 'compress_image' });
    expect(container).toBeEmptyDOMElement();
  });
});
