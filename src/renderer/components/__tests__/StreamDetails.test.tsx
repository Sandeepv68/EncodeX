import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StreamDetails from '../StreamDetails';
import type { MediaStreamInfo } from '../../../shared/types';

const streams: MediaStreamInfo[] = [
  {
    index: 0,
    type: 'video',
    codec: 'h264',
    width: 1920,
    height: 1080,
    pixelFormat: 'yuv420p',
    frameRate: '30.00',
    bitrate: '1000000',
  },
  {
    index: 1,
    type: 'audio',
    codec: 'aac',
    sampleRate: 48000,
    channels: 2,
    language: 'eng',
  },
];

describe('StreamDetails', () => {
  it('renders a stream title with the stream count', () => {
    render(<StreamDetails streams={streams} />);
    expect(screen.getByText(/mediaInfo\.streams/)).toBeInTheDocument();
  });

  it('renders one card per stream', () => {
    render(<StreamDetails streams={streams} />);
    expect(screen.getByText('mediaInfo.stream #0')).toBeInTheDocument();
    expect(screen.getByText('mediaInfo.stream #1')).toBeInTheDocument();
  });

  it('renders video stream metadata', () => {
    render(<StreamDetails streams={streams} />);
    expect(screen.getByText(/h264/)).toBeInTheDocument();
    expect(screen.getByText(/1920x1080/)).toBeInTheDocument();
    expect(screen.getByText(/yuv420p/)).toBeInTheDocument();
    expect(screen.getByText(/30\.00 fps/)).toBeInTheDocument();
    expect(screen.getByText(/1000000/)).toBeInTheDocument();
  });

  it('renders audio stream metadata', () => {
    render(<StreamDetails streams={streams} />);
    expect(screen.getByText(/48000 Hz/)).toBeInTheDocument();
    expect(screen.getByText(/eng/)).toBeInTheDocument();
  });

  it('renders nothing for an empty stream list besides the title', () => {
    render(<StreamDetails streams={[]} />);
    expect(screen.getByText(/\(0\)/)).toBeInTheDocument();
  });

  it('handles sparse stream entries without crashing', () => {
    render(<StreamDetails streams={[{ index: 0, type: 'video', codec: '' }]} />);
    expect(screen.getByText('mediaInfo.stream #0')).toBeInTheDocument();
  });
});
