import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import BatchEncodingPanel from '../BatchEncodingPanel';
import { useDismissedAlertsStore } from '../../stores/dismissedAlertsStore';

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
  beforeEach(() => {
    useDismissedAlertsStore.setState({ dismissed: [] });
  });

  it('renders the encoding options title', () => {
    renderPanel();
    expect(screen.getByText('batchQueue.encodingOptions')).toBeInTheDocument();
  });

  it('shows the options-editable alert when queued jobs allow editing', () => {
    renderPanel({ optionsEditable: true });
    expect(screen.getByText('batchQueue.optionsEditableAlert')).toBeInTheDocument();
    expect(screen.queryByText('batchQueue.optionsLockedAlert')).not.toBeInTheDocument();
  });

  it('shows the options-locked alert while the batch is running', () => {
    renderPanel({ optionsLocked: true });
    expect(screen.getByText('batchQueue.optionsLockedAlert')).toBeInTheDocument();
    expect(screen.queryByText('batchQueue.optionsEditableAlert')).not.toBeInTheDocument();
  });

  it('shows no option alert by default', () => {
    renderPanel();
    expect(screen.queryByText('batchQueue.optionsEditableAlert')).not.toBeInTheDocument();
    expect(screen.queryByText('batchQueue.optionsLockedAlert')).not.toBeInTheDocument();
  });

  it('dismisses the options-editable alert via its close button', () => {
    renderPanel({ optionsEditable: true });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('batchQueue.optionsEditableAlert')).not.toBeInTheDocument();
  });

  it('dismisses the options-locked alert via its close button', () => {
    renderPanel({ optionsLocked: true });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('batchQueue.optionsLockedAlert')).not.toBeInTheDocument();
  });

  it('re-shows the locked alert after the editable alert was dismissed', () => {
    const { props, rerender } = renderPanel({ optionsEditable: true });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('batchQueue.optionsEditableAlert')).not.toBeInTheDocument();
    rerender(<BatchEncodingPanel {...props} optionsEditable={false} optionsLocked />);
    expect(screen.getByText('batchQueue.optionsLockedAlert')).toBeInTheDocument();
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

  it('lists only containers compatible with the selected audio codec', () => {
    renderPanel({ operation: 'extract_audio', audioCodec: 'aac' });
    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
    expect(screen.getByText('batchQueue.containerAuto')).toBeInTheDocument();
    expect(screen.getByText('m4a')).toBeInTheDocument();
    expect(screen.queryByText('mp3')).not.toBeInTheDocument();
  });

  it('shows mp3 containers for the libmp3lame audio codec', () => {
    renderPanel({ operation: 'extract_audio', audioCodec: 'libmp3lame' });
    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
    expect(screen.getByText('batchQueue.containerAuto')).toBeInTheDocument();
    expect(screen.getByText('mp3')).toBeInTheDocument();
    expect(screen.queryByText('m4a')).not.toBeInTheDocument();
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

  it('names each control via its field label', () => {
    renderPanel();
    expect(screen.getByRole('combobox', { name: 'convert.videoCodec' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'convert.audioCodec' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'batchQueue.container' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'convert.videoBitrate' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'convert.audioBitrate' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'convert.scale' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'convert.pixelFormat' })).toBeInTheDocument();
  });

  it('names the image and quality controls for compress_image', () => {
    renderPanel({ operation: 'compress_image' });
    expect(screen.getByRole('combobox', { name: 'imageCompress.outputFormat' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'imageCompress.scale' })).toBeInTheDocument();
    expect(screen.getByLabelText('imageCompress.quality')).toBeInTheDocument();
  });
});
