import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
    rotate: '',
    flipH: false,
    flipV: false,
    pixelFormat: 'yuv420p',
    videoFilters: [],
    demuxKinds: ['video', 'audio', 'subtitle'],
    demuxVideoContainer: '',
    demuxAudioCodec: '',
    demuxSubtitleFormat: '',
    onVideoCodecChange: vi.fn(),
    onAudioCodecChange: vi.fn(),
    onContainerChange: vi.fn(),
    onVideoBitrateChange: vi.fn(),
    onAudioBitrateChange: vi.fn(),
    onQualityChange: vi.fn(),
    onScaleChange: vi.fn(),
    onRotateChange: vi.fn(),
    onFlipHChange: vi.fn(),
    onFlipVChange: vi.fn(),
    onPixelFormatChange: vi.fn(),
    onVideoFiltersChange: vi.fn(),
    onDemuxKindsChange: vi.fn(),
    onDemuxVideoContainerChange: vi.fn(),
    onDemuxAudioCodecChange: vi.fn(),
    onDemuxSubtitleFormatChange: vi.fn(),
    ...props,
  };
  const utils = render(<BatchEncodingPanel {...all} />);
  return { props: all, ...utils };
}

function expectMenuOption(text: string) {
  expect(within(screen.getByRole('listbox')).getByText(text)).toBeInTheDocument();
}

function expectNoMenuOption(text: string) {
  expect(within(screen.getByRole('listbox')).queryByText(text)).not.toBeInTheDocument();
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

  it('renders all controls for the transcode operation', () => {
    renderPanel();
    expect(screen.getAllByRole('combobox')).toHaveLength(10);
    expect(screen.getByText('convert.videoBitrate')).toBeInTheDocument();
    expect(screen.getByText('convert.audioBitrate')).toBeInTheDocument();
    expect(screen.getByText('convert.scale')).toBeInTheDocument();
    expect(screen.getByText('yuv420p')).toBeInTheDocument();
    expect(screen.getByTestId('video-filters-section')).toBeInTheDocument();
  });

  it('shows placeholders in every transcode select whose value is empty', () => {
    renderPanel({ container: '', videoBitrate: '', audioBitrate: '', scale: '', rotate: '' });
    expect(screen.getByRole('combobox', { name: 'batchQueue.container' })).toHaveTextContent('batchQueue.containerAuto');
    expect(screen.getByRole('combobox', { name: 'convert.videoBitrate' })).toHaveTextContent('status.auto');
    expect(screen.getByRole('combobox', { name: 'convert.audioBitrate' })).toHaveTextContent('status.auto');
    expect(screen.getByRole('combobox', { name: 'convert.scale' })).toHaveTextContent('status.none');
    expect(screen.getByRole('combobox', { name: 'convert.rotation' })).toHaveTextContent('status.none');
  });

  it('shows placeholders in the image selects whose value is empty', () => {
    renderPanel({ operation: 'compress_image', container: '', scale: '' });
    expect(screen.getByRole('combobox', { name: 'imageCompress.outputFormat' })).toHaveTextContent('batchQueue.containerAuto');
    expect(screen.getByRole('combobox', { name: 'imageCompress.scale' })).toHaveTextContent('status.none');
  });

  it('shows the placeholder in the remux container select while it is empty', () => {
    renderPanel({ operation: 'remux', container: '' });
    expect(screen.getByRole('combobox', { name: 'batchQueue.container' })).toHaveTextContent('batchQueue.containerAuto');
  });

  it('lists the container options compatible with the selected video codec', () => {
    renderPanel();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[3]);
    expectMenuOption('batchQueue.containerAuto');
    expectMenuOption('mp4');
    expectMenuOption('mkv');
    expectNoMenuOption('webm');
  });

  it('fires onContainerChange when a container is chosen', () => {
    const { props } = renderPanel();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[3]);
    fireEvent.click(screen.getByText('mkv'));
    expect(props.onContainerChange).toHaveBeenCalledWith('mkv');
  });

  it('fires onVideoCodecChange when a video codec is chosen', () => {
    const { props } = renderPanel();
    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
    fireEvent.click(screen.getByText('Theora (libtheora)'));
    expect(props.onVideoCodecChange).toHaveBeenCalledWith('libtheora');
  });

  it('renders only audio controls for the extract audio operation', () => {
    renderPanel({ operation: 'extract_audio' });
    expect(screen.getAllByRole('combobox')).toHaveLength(4);
    expect(screen.getByText('convert.audioBitrate')).toBeInTheDocument();
    expect(screen.queryByText('convert.videoBitrate')).not.toBeInTheDocument();
    expect(screen.queryByText('convert.scale')).not.toBeInTheDocument();
  });

  it('lists only containers compatible with the selected audio codec', () => {
    renderPanel({ operation: 'extract_audio', audioCodec: 'aac' });
    fireEvent.mouseDown(screen.getAllByRole('combobox')[2]);
    expectMenuOption('batchQueue.containerAuto');
    expectMenuOption('m4a');
    expectNoMenuOption('mp3');
  });

  it('shows mp3 containers for the libmp3lame audio codec', () => {
    renderPanel({ operation: 'extract_audio', audioCodec: 'libmp3lame' });
    fireEvent.mouseDown(screen.getAllByRole('combobox')[2]);
    expectMenuOption('batchQueue.containerAuto');
    expectMenuOption('mp3');
    expectNoMenuOption('m4a');
  });

  it('renders image controls for the compress image operation', () => {
    renderPanel({ operation: 'compress_image' });
    expect(screen.getByText('imageCompress.outputFormat')).toBeInTheDocument();
    expect(screen.getByText('imageCompress.quality')).toBeInTheDocument();
    expect(screen.getByText('imageCompress.scale')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(4);
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
    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
    expectMenuOption('batchQueue.containerAuto');
    expect(screen.getByText('JPEG')).toBeInTheDocument();
    expectMenuOption('WebP');
  });

  it('names each control via its field label', () => {
    renderPanel();
    expect(screen.getByRole('combobox', { name: 'convert.videoCodec' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'convert.audioCodec' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'batchQueue.container' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'convert.videoBitrate' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'convert.audioBitrate' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'convert.scale' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'convert.rotation' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'convert.flipHorizontal' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'convert.flipVertical' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'convert.pixelFormat' })).toBeInTheDocument();
  });

  it('fires rotation and mirror change callbacks', () => {
    const { props } = renderPanel({ rotate: '90', flipH: true, flipV: false });
    const rotateInput = screen.getByTestId('batch-rotation').querySelector('input')!;
    fireEvent.change(rotateInput, { target: { value: '180' } });
    expect(props.onRotateChange).toHaveBeenCalledWith('180');
    expect(screen.getByRole('switch', { name: 'convert.flipHorizontal' })).toBeChecked();
    fireEvent.click(screen.getByRole('switch', { name: 'convert.flipVertical' }));
    expect(props.onFlipVChange).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('switch', { name: 'convert.flipHorizontal' }));
    expect(props.onFlipHChange).toHaveBeenCalledWith(false);
  });

  it('hides rotation and mirror controls for extract_audio', () => {
    renderPanel({ operation: 'extract_audio' });
    expect(screen.queryByRole('combobox', { name: 'convert.rotation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'convert.flipHorizontal' })).not.toBeInTheDocument();
  });

  it('names the image and quality controls for compress_image', () => {
    renderPanel({ operation: 'compress_image' });
    expect(screen.getByRole('combobox', { name: 'imageCompress.outputFormat' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'imageCompress.scale' })).toBeInTheDocument();
    expect(screen.getByLabelText('imageCompress.quality')).toBeInTheDocument();
  });

  it('hides the video filters section for extract_audio', () => {
    renderPanel({ operation: 'extract_audio' });
    expect(screen.queryByTestId('video-filters-section')).not.toBeInTheDocument();
  });

  it('adds a preset filter through onVideoFiltersChange', () => {
    const { props } = renderPanel();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Add preset filter...' }));
    fireEvent.click(screen.getByRole('option', { name: 'Crop' }));
    fireEvent.click(screen.getByTestId('filters-add-preset'));
    expect(props.onVideoFiltersChange).toHaveBeenCalledWith(['crop=in_w:in_h']);
  });

  it('clears all filters through onVideoFiltersChange', () => {
    const { props } = renderPanel({ videoFilters: ['fps=30', 'hflip'] });
    fireEvent.click(screen.getByTestId('filters-clear-all'));
    expect(props.onVideoFiltersChange).toHaveBeenCalledWith([]);
  });

  it('disables the filters section while the batch is locked', () => {
    renderPanel({ optionsLocked: true, videoFilters: ['hflip'] });
    expect(screen.getByRole('combobox', { name: 'Add preset filter...' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('filters-add-custom')).toBeDisabled();
  });

  it('renders only the container select for the remux operation', () => {
    renderPanel({ operation: 'remux' });
    expect(screen.getByRole('combobox', { name: 'batchQueue.container' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'convert.videoCodec' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'convert.audioCodec' })).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'batchQueue.container' }));
    expectMenuOption('batchQueue.containerAuto');
    expectMenuOption('mkv');
    expectMenuOption('mp4');
  });

  it('fires onContainerChange when a remux container is chosen', () => {
    const { props } = renderPanel({ operation: 'remux' });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'batchQueue.container' }));
    fireEvent.click(screen.getByText('mov'));
    expect(props.onContainerChange).toHaveBeenCalledWith('mov');
  });

  it('renders the stream-kind toggles and per-kind targets for the demux operation', () => {
    renderPanel({ operation: 'demux' });
    expect(screen.getByRole('switch', { name: 'Video' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Audio' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Subtitle' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'demux.videoContainer' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'demux.audioCodec' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'demux.subtitleFormat' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'convert.videoCodec' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'batchQueue.container' })).not.toBeInTheDocument();
  });

  it('fires onDemuxKindsChange when a stream kind is toggled', () => {
    const { props } = renderPanel({ operation: 'demux', demuxKinds: ['video'] });
    fireEvent.click(screen.getByRole('switch', { name: 'Audio' }));
    expect(props.onDemuxKindsChange).toHaveBeenCalledWith(['video', 'audio']);
    fireEvent.click(screen.getByRole('switch', { name: 'Video' }));
    expect(props.onDemuxKindsChange).toHaveBeenCalledWith([]);
  });

  it('maps the copy target to an empty value and back', () => {
    const { props, rerender } = renderPanel({ operation: 'demux', demuxVideoContainer: 'mp4' });
    expect(screen.getByRole('combobox', { name: 'demux.videoContainer' })).toHaveTextContent('mp4');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'demux.videoContainer' }));
    fireEvent.click(screen.getAllByRole('option', { name: 'demux.copyOption' })[0]);
    expect(props.onDemuxVideoContainerChange).toHaveBeenCalledWith('');
    rerender(<BatchEncodingPanel {...props} demuxVideoContainer="" />);
    expect(screen.getByRole('combobox', { name: 'demux.videoContainer' })).toHaveTextContent('demux.copyOption');
  });

  it('fires the demux conversion-target change callbacks', () => {
    const { props } = renderPanel({ operation: 'demux', demuxKinds: ['subtitle'] });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'demux.subtitleFormat' }));
    fireEvent.click(screen.getByText('srt'));
    expect(props.onDemuxSubtitleFormatChange).toHaveBeenCalledWith('srt');
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'demux.audioCodec' }));
    fireEvent.click(screen.getByText('flac'));
    expect(props.onDemuxAudioCodecChange).toHaveBeenCalledWith('flac');
  });
});
