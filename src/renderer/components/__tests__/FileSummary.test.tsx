import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FileSummary from '../FileSummary';
import type { MediaInfo } from '../../../shared/types';

const info: MediaInfo = {
  file: 'video.mp4',
  format: 'mp4',
  size: 2097152,
  duration: 12.34,
  bitrate: '800000',
  streams: [],
};

describe('FileSummary', () => {
  it('renders the file metadata values', () => {
    render(<FileSummary info={info} />);
    expect(screen.getByText('video.mp4')).toBeInTheDocument();
    expect(screen.getByText('mp4')).toBeInTheDocument();
    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
    expect(screen.getByText('12.34s')).toBeInTheDocument();
    expect(screen.getByText('800000')).toBeInTheDocument();
  });

  it('renders labels for each field', () => {
    render(<FileSummary info={info} />);
    expect(screen.getByText('mediaInfo.file')).toBeInTheDocument();
    expect(screen.getByText('mediaInfo.format')).toBeInTheDocument();
    expect(screen.getByText('mediaInfo.size')).toBeInTheDocument();
    expect(screen.getByText('mediaInfo.duration')).toBeInTheDocument();
    expect(screen.getByText('mediaInfo.bitrate')).toBeInTheDocument();
  });

  it('renders zero-size values', () => {
    render(<FileSummary info={{ ...info, size: 0, duration: 0 }} />);
    expect(screen.getByText('0 B')).toBeInTheDocument();
    expect(screen.getByText('0.00s')).toBeInTheDocument();
  });

  it('renders extended file metadata when present', () => {
    render(
      <FileSummary
        info={{
          ...info,
          formatLong: 'MPEG-4 Part 14',
          startTime: 0.25,
          probeScore: 100,
        }}
      />,
    );
    expect(screen.getByText('mp4 (MPEG-4 Part 14)')).toBeInTheDocument();
    expect(screen.getByText('0.25')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('mediaInfo.streamsCount')).toBeInTheDocument();
  });

  it('renders file tags when present', () => {
    render(<FileSummary info={{ ...info, tags: { encoder: 'libx265', creation_time: '2024-01-01' } }} />);
    expect(screen.getByText('mediaInfo.tags')).toBeInTheDocument();
    expect(screen.getByText('Encoder')).toBeInTheDocument();
    expect(screen.getByText('libx265')).toBeInTheDocument();
    expect(screen.getByText('creation_time')).toBeInTheDocument();
  });

  it('renders in compact layout', () => {
    render(<FileSummary info={{ ...info, formatLong: 'MPEG-4 Part 14', tags: { encoder: 'libx265' } }} compact />);
    expect(screen.getByText('video.mp4')).toBeInTheDocument();
    expect(screen.getByText('mp4 (MPEG-4 Part 14)')).toBeInTheDocument();
    expect(screen.getByText('Encoder')).toBeInTheDocument();
  });

  it('omits the tags section when there are no tags', () => {
    render(<FileSummary info={info} />);
    expect(screen.queryByText('mediaInfo.tags')).not.toBeInTheDocument();
  });
});
