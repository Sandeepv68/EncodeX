import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import NavJobPopover from '../NavJobPopover';
import { clearPreviewCache } from '../../utils/preview-cache';
import type { NavBlipId, NavJobPopoverContent } from '../types';

function Host({ content, active }: { content: NavJobPopoverContent | null; active?: NavBlipId }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <button ref={setAnchor} data-testid="host">
        host
      </button>
      <NavJobPopover
        active={active === undefined ? (anchor ? 'convert' : null) : active}
        anchorEl={anchor}
        onClose={vi.fn()}
        content={content}
      />
    </>
  );
}

describe('NavJobPopover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPreviewCache();
    vi.mocked(window.electronAPI.getVideoPreview).mockResolvedValue(null);
    vi.mocked(window.electronAPI.getImagePreview).mockResolvedValue(null);
  });

  it('renders the "starting" caption when progress is null', () => {
    render(<Host content={{ title: 'Convert', status: 'Converting', fileName: 'video.mp4', progress: null }} />);
    const popover = screen.getByTestId('nav-job-popover');
    expect(popover).toHaveTextContent('Convert');
    expect(popover).toHaveTextContent('Converting');
    expect(popover).toHaveTextContent('video.mp4');
    expect(popover).toHaveTextContent('Starting');
    expect(screen.getByTestId('nav-job-popover-arrow')).toBeInTheDocument();
  });

  it('renders the paused tag when the job is paused', () => {
    render(
      <Host
        content={{
          title: 'Convert',
          status: 'Converting',
          fileName: 'video.mp4',
          progress: { percent: 33, time: '00:00:10', speed: '1x', eta: '20' },
          paused: true,
        }}
      />,
    );
    const popover = screen.getByTestId('nav-job-popover');
    expect(within(popover).getByRole('progressbar')).toBeInTheDocument();
    expect(popover).toHaveTextContent('Paused');
  });

  it('renders nothing when closed', () => {
    render(<Host content={{ title: 'Convert', status: 'Converting', fileName: '', progress: null }} active={null} />);
    expect(screen.queryByTestId('nav-job-popover')).not.toBeInTheDocument();
  });

  it('renders nothing when content is null', () => {
    render(<Host content={null} />);
    expect(screen.queryByTestId('nav-job-popover')).not.toBeInTheDocument();
  });

  it('renders a thumbnail for the job input fetched from the preview API', async () => {
    vi.mocked(window.electronAPI.getVideoPreview).mockResolvedValue('data:image/png;base64,VIDEO');
    render(
      <Host content={{ title: 'Convert', status: 'Converting', fileName: 'clip.mp4', progress: null, input: 'C:/videos/clip.mp4' }} />,
    );
    const img = await screen.findByTestId('nav-job-popover-thumbnail');
    expect(img).toHaveAttribute('src', 'data:image/png;base64,VIDEO');
    expect(window.electronAPI.getVideoPreview).toHaveBeenCalledWith('C:/videos/clip.mp4');
  });

  it('does not render a thumbnail when no input path is known', () => {
    render(<Host content={{ title: 'Convert', status: 'Converting', fileName: 'clip.mp4', progress: null }} />);
    expect(screen.queryByTestId('nav-job-popover-thumbnail')).not.toBeInTheDocument();
  });

  it('does not fetch a thumbnail for audio-only sources', async () => {
    render(<Host content={{ title: 'Convert', status: 'Converting', fileName: 'song.mp3', progress: null, input: 'C:/music/song.mp3' }} />);
    expect(await screen.findByTestId('nav-job-popover')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-job-popover-thumbnail')).not.toBeInTheDocument();
    expect(window.electronAPI.getVideoPreview).not.toHaveBeenCalled();
    expect(window.electronAPI.getImagePreview).not.toHaveBeenCalled();
  });

  it('renders an overlapping pile of pending-job thumbnails', () => {
    render(
      <Host
        content={{
          title: 'Batch Queue',
          status: '2 queued, 1 running, 0 done, 0 failed',
          fileName: 'run.mp4',
          progress: { percent: 50, time: '00:00:20', speed: '2x', eta: '10' },
          input: 'C:/videos/run.mp4',
          pendingThumbnails: ['C:/videos/one.mp4', 'C:/videos/two.mp4'],
        }}
      />,
    );
    const pile = screen.getByTestId('nav-job-popover-pile');
    expect(within(pile).getAllByTestId('nav-job-popover-pile-thumb')).toHaveLength(2);
    expect(within(pile).queryByTestId('nav-job-popover-pile-count')).not.toBeInTheDocument();
  });

  it('truncates the pile and shows the remaining count', () => {
    const inputs = Array.from({ length: 11 }, (_, i) => `C:/videos/job${i}.mp4`);
    render(
      <Host
        content={{
          title: 'Batch Queue',
          status: '11 queued, 0 running, 0 done, 0 failed',
          fileName: '',
          progress: null,
          pendingThumbnails: inputs,
        }}
      />,
    );
    const pile = screen.getByTestId('nav-job-popover-pile');
    expect(within(pile).getAllByTestId('nav-job-popover-pile-thumb')).toHaveLength(8);
    expect(screen.getByTestId('nav-job-popover-pile-count')).toHaveTextContent('+3');
  });

  it('renders no pile when there are no pending thumbnails', () => {
    render(<Host content={{ title: 'Convert', status: 'Converting', fileName: 'clip.mp4', progress: null }} />);
    expect(screen.queryByTestId('nav-job-popover-pile')).not.toBeInTheDocument();
  });
});
