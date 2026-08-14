import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  pixelFormat: 'yuv420p',
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

  it('renders the dialog title with the input basename', () => {
    renderDialog(makeJob());
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

  it('renders nothing when no job is provided', () => {
    const { container } = renderDialog(null);
    expect(container).toBeEmptyDOMElement();
  });
});
