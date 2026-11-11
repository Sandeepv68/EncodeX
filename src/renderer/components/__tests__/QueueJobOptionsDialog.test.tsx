import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import QueueJobOptionsDialog from '../QueueJobOptionsDialog';
import { QUEUE_STATUS } from '../../../shared/media-options';
import type { QueueJob } from '../../../shared/types';
import type { BatchEncodingValues } from '../../utils/batch-options';

const DEFAULTS: BatchEncodingValues = {
  videoCodec: 'libx264',
  audioCodec: 'aac',
  container: 'mkv',
  videoBitrate: '4000k',
  audioBitrate: '320k',
  quality: '',
  scale: '',
  rotate: '',
  flipH: false,
  flipV: false,
  pixelFormat: 'yuv420p',
  videoFilters: [],
};

function makeJob(overrides: Partial<QueueJob> = {}): QueueJob {
  return {
    id: 'j1',
    input: 'C:/videos/clip.mp4',
    output: 'C:/videos/clip_encodex_converted.mp4',
    options: {
      videoCodec: 'libx264',
      audioCodec: 'aac',
      videoBitrate: '2000k',
      audioBitrate: '192k',
      scale: '1280x720',
      rotate: '180',
      flipH: true,
      pixelFormat: 'yuv420p',
      hardwareAcceleration: true,
      hwaccelMode: 'auto',
    },
    transcoder: 'FFMPEG',
    status: QUEUE_STATUS.QUEUED,
    progress: 0,
    createdAt: 1,
    ...overrides,
  };
}

function renderDialog(job: QueueJob | null, onSave: () => void = vi.fn(), onClose: () => void = vi.fn()) {
  const utils = render(<QueueJobOptionsDialog open={job !== null} job={job} defaults={DEFAULTS} onSave={onSave} onClose={onClose} />);
  return { onSave, onClose, ...utils };
}

describe('QueueJobOptionsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the dialog title with the input basename', async () => {
    // The panel's CodecSelects probe the encoder capabilities asynchronously, and
    // the probe resolves into a state update, so the mount has to settle inside
    // act() or the update escapes the test's control.
    await act(async () => {
      renderDialog(makeJob());
    });
    expect(screen.getByText('Edit options for clip.mp4')).toBeInTheDocument();
  });

  it('renders save and cancel actions', () => {
    renderDialog(makeJob());
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'batchQueue.dialogCancel' })).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked without saving', () => {
    const { onSave, onClose } = renderDialog(makeJob());
    fireEvent.click(screen.getByRole('button', { name: 'batchQueue.dialogCancel' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('seeds the panel from the job options and defaults', () => {
    renderDialog(makeJob());
    expect(screen.getByText('1280x720')).toBeInTheDocument();
    expect(screen.getByText('yuv420p')).toBeInTheDocument();
  });

  it('seeds rotation and mirror from the job options and saves them', () => {
    const { onSave } = renderDialog(makeJob());
    expect(screen.getByRole('switch', { name: 'convert.flipHorizontal' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledWith(
      makeJob(),
      expect.objectContaining({ rotate: '180', flipH: true, flipV: undefined }),
      'C:/videos/clip_encodex_converted.mp4',
    );
  });

  it('seeds the container from the job output extension', () => {
    renderDialog(makeJob());
    const container = screen.getByRole('combobox', { name: 'batchQueue.container' });
    expect(container).toHaveTextContent('mp4');
  });

  it('calls onSave with the job, built options, and recomputed output', () => {
    const { onSave } = renderDialog(makeJob());
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledWith(
      makeJob(),
      expect.objectContaining({
        videoCodec: 'libx264',
        audioCodec: 'aac',
        videoBitrate: '2000k',
        audioBitrate: '192k',
        scale: '1280x720',
        pixelFormat: 'yuv420p',
      }),
      'C:/videos/clip_encodex_converted.mp4',
    );
  });

  it('recomputes the output path when the container changes', () => {
    const { onSave } = renderDialog(makeJob());
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'batchQueue.container' }));
    fireEvent.click(screen.getByText('mkv'));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledWith(makeJob(), expect.any(Object), 'C:/videos/clip_encodex_converted.mkv');
  });

  it('edits a compress_image job using its qscale and output format', () => {
    const { onSave } = renderDialog(
      makeJob({
        input: 'C:/imgs/photo.png',
        output: 'C:/imgs/photo_encodex_converted.webp',
        options: { qscale: 20, scale: '1280x720', hardwareAcceleration: false, hwaccelMode: 'auto' },
      }),
    );
    expect(screen.getByRole('combobox', { name: 'imageCompress.outputFormat' })).toHaveTextContent('WebP');
    expect(screen.getByRole('spinbutton')).toHaveValue(20);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'j1' }),
      expect.objectContaining({ qscale: 20, scale: '1280x720' }),
      'C:/imgs/photo_encodex_converted.webp',
    );
  });

  it('seeds and saves video filters for a transcode job', () => {
    const { onSave } = renderDialog(makeJob({ options: { ...makeJob().options, videoFilters: ['hflip'] } }));
    expect(screen.getByText('hflip')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'j1' }),
      expect.objectContaining({ videoFilters: ['hflip'] }),
      expect.any(String),
    );
  });

  it('edits an extract_audio job using its audio codec', () => {
    const { onSave } = renderDialog(
      makeJob({
        input: 'C:/videos/clip.mkv',
        output: 'C:/videos/clip_encodex_converted.m4a',
        options: { audioCodec: 'aac', audioBitrate: '128k', hardwareAcceleration: true, hwaccelMode: 'auto' },
      }),
    );
    expect(screen.getByRole('combobox', { name: 'batchQueue.container' })).toHaveTextContent('m4a');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'j1' }),
      expect.objectContaining({ audioCodec: 'aac', audioBitrate: '128k', videoCodec: undefined }),
      'C:/videos/clip_encodex_converted.m4a',
    );
  });

  it('clears an incompatible container when the video codec changes', async () => {
    // The codec selects probe the encoder capabilities asynchronously, so the
    // mount has to settle inside act() before the dropdowns can be opened.
    await act(async () => {
      renderDialog(makeJob());
    });
    // The .mp4 output seeds the container as 'mp4', and VP8 can only be muxed
    // into webm/mkv/avi, so choosing it must reset the container to auto.
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'convert.videoCodec' }));
    fireEvent.click(screen.getByText('VP8 (libvpx)'));
    expect(screen.getByRole('combobox', { name: 'batchQueue.container' })).toHaveTextContent('batchQueue.containerAuto');
  });

  it('clears an incompatible container when the audio codec changes', async () => {
    await act(async () => {
      renderDialog(makeJob());
    });
    // MP2 can only be muxed into .mp2, so choosing it must clear the seeded
    // 'mp4' container back to auto.
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'convert.audioCodec' }));
    fireEvent.click(screen.getByText('MP2 (libtwolame)'));
    expect(screen.getByRole('combobox', { name: 'batchQueue.container' })).toHaveTextContent('batchQueue.containerAuto');
  });

  it('applies the bitrate, scale, rotation, mirror and filter edits', () => {
    const { onSave } = renderDialog(makeJob());
    fireEvent.mouseDown(screen.getByLabelText('convert.videoBitrate'));
    fireEvent.click(screen.getByRole('option', { name: '4000k' }));
    fireEvent.mouseDown(screen.getByLabelText('convert.audioBitrate'));
    fireEvent.click(screen.getByRole('option', { name: '320k' }));
    fireEvent.mouseDown(screen.getByLabelText('convert.scale'));
    fireEvent.click(screen.getByRole('option', { name: '1280x720' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'j1' }),
      expect.objectContaining({ videoBitrate: '4000k', audioBitrate: '320k', scale: '1280x720' }),
      expect.any(String),
    );
  });

  it('applies edits to the scale, rotation, mirrors, pixel format, and filters', async () => {
    const { onSave } = renderDialog(makeJob());
    // The codec selects probe the encoder capabilities asynchronously, so the
    // mount has to settle inside act() before the dropdowns can be opened.
    await act(async () => {});
    // Every control must move to a different value than the seeded one, or the
    // selects swallow the change.
    fireEvent.mouseDown(screen.getByLabelText('convert.scale'));
    fireEvent.click(screen.getByRole('option', { name: '1920x1080' }));
    fireEvent.change(screen.getByTestId('batch-rotation').querySelector('input')!, { target: { value: '90' } });
    fireEvent.click(screen.getByRole('switch', { name: 'convert.flipHorizontal' }));
    fireEvent.click(screen.getByRole('switch', { name: 'convert.flipVertical' }));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'convert.pixelFormat' }));
    fireEvent.click(screen.getByRole('option', { name: 'yuv422p' }));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Add preset filter...' }));
    fireEvent.click(screen.getByRole('option', { name: 'Crop' }));
    fireEvent.click(screen.getByTestId('filters-add-preset'));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'j1' }),
      expect.objectContaining({
        scale: '1920x1080',
        rotate: '90',
        flipH: undefined,
        flipV: true,
        pixelFormat: 'yuv422p',
        videoFilters: ['crop=in_w:in_h'],
      }),
      'C:/videos/clip_encodex_converted.mp4',
    );
  });

  it('applies a quality edit to a compress_image job', () => {
    const { onSave } = renderDialog(
      makeJob({
        input: 'C:/imgs/photo.png',
        output: 'C:/imgs/photo_encodex_converted.webp',
        options: { qscale: 20, hardwareAcceleration: false, hwaccelMode: 'auto' },
      }),
    );
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'j1' }),
      expect.objectContaining({ qscale: 80 }),
      'C:/imgs/photo_encodex_converted.webp',
    );
  });

  it('renders nothing when no job is provided', () => {
    const { container } = renderDialog(null);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps a stream-copy job's options intact, because the batch panel cannot express them", () => {
    // A stream-copy job cannot be rebuilt from the transcode panel's fields:
    // doing so would drop `copy` and silently turn the lossless copy into a
    // re-encode. Its options are therefore forwarded untouched.
    const { onSave } = renderDialog(
      makeJob({
        output: 'C:/videos/clip_encodex_converted.mkv',
        options: { copy: true, video: true, audio: true, hardwareAcceleration: true, hwaccelMode: 'auto' },
      }),
    );
    expect(screen.getByRole('combobox', { name: 'batchQueue.container' })).toHaveTextContent('mkv');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ copy: true }),
      'C:/videos/clip_encodex_converted.mkv',
    );
  });

  it('keeps a per-stream map when a demux-shaped job is saved', () => {
    // Same reasoning for a demux job: the batch queue cannot express a
    // per-stream extraction, so the map must survive a save untouched rather
    // than being dropped by the transcode-shaped rebuild.
    const { onSave } = renderDialog(
      makeJob({
        input: 'C:/videos/clip.mkv',
        output: 'C:/videos/clip.audio_1_encodex_demux.m4a',
        options: {
          copy: false,
          video: false,
          audio: true,
          map: ['0:1'],
          audioCodec: 'aac',
          hardwareAcceleration: true,
          hwaccelMode: 'auto',
        },
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'j1' }),
      expect.objectContaining({ map: ['0:1'] }),
      'C:/videos/clip.audio_1_encodex_demux.m4a',
    );
  });
});
