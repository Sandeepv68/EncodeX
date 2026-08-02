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
    expect(screen.getByTestId('stream-count-chip')).toHaveTextContent('0');
  });

  it('handles sparse stream entries without crashing', () => {
    render(<StreamDetails streams={[{ index: 0, type: 'video', codec: '' }]} />);
    expect(screen.getByText('mediaInfo.stream #0')).toBeInTheDocument();
  });

  it('renders extended stream metadata', () => {
    const rich: MediaStreamInfo = {
      index: 2,
      type: 'video',
      codec: 'hevc',
      codecLong: 'H.265 / HEVC',
      codecTag: 'hvc1',
      profile: 'Main 10',
      level: 120,
      width: 3840,
      height: 2160,
      displayAspectRatio: '16:9',
      pixelFormat: 'yuv420p10le',
      colorSpace: 'bt2020nc',
      colorTransfer: 'smpte2084',
      colorPrimaries: 'bt2020',
      colorRange: 'tv',
      fieldOrder: 'progressive',
      frameRate: '59.94',
      avgFrameRate: '50.00',
      bitDepth: 10,
      bitrate: '25000000',
      duration: 60,
      startTime: 0.5,
      frameCount: 3000,
      title: 'Clip',
      language: 'eng',
    };
    render(<StreamDetails streams={[rich]} />);
    expect(screen.getByText(/hvc1/)).toBeInTheDocument();
    expect(screen.getByText(/Main 10/)).toBeInTheDocument();
    expect(screen.getByText(/16:9/)).toBeInTheDocument();
    expect(screen.getByText(/bt2020nc/)).toBeInTheDocument();
    expect(screen.getByText(/smpte2084/)).toBeInTheDocument();
    expect(screen.getByText(/progressive/)).toBeInTheDocument();
    expect(screen.getByText(/50\.00 fps/)).toBeInTheDocument();
    expect(screen.getByText(/60\.00s/)).toBeInTheDocument();
    expect(screen.getByText(/Clip/)).toBeInTheDocument();
  });

  it('renders disposition chips and stream tags', () => {
    render(
      <StreamDetails
        streams={[
          {
            index: 0,
            type: 'audio',
            codec: 'aac',
            disposition: ['default', 'forced'],
            tags: { language: 'eng', title: 'Commentary' },
          },
        ]}
      />,
    );
    expect(screen.getByText('default')).toBeInTheDocument();
    expect(screen.getByText('forced')).toBeInTheDocument();
    expect(screen.getByText(/Commentary/)).toBeInTheDocument();
  });
});
