import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExifSection from '../ExifSection';
import type { ImageExifData } from '../../../shared/types';

const DATA_WITH_HISTOGRAM: ImageExifData = {
  file: 'photo.jpg',
  exif: { Make: 'Canon', ISO: '200' },
  histogram: {
    r: new Array(256).fill(0),
    g: new Array(256).fill(0),
    b: new Array(256).fill(0),
    luma: new Array(256).fill(0),
  },
};

describe('ExifSection', () => {
  it('renders the EXIF data title', () => {
    render(<ExifSection data={DATA_WITH_HISTOGRAM} />);
    expect(screen.getByText('EXIF Data')).toBeInTheDocument();
  });

  it('renders one field per exif entry', () => {
    render(<ExifSection data={DATA_WITH_HISTOGRAM} />);
    expect(screen.getByText('Make')).toBeInTheDocument();
    expect(screen.getByText('Canon')).toBeInTheDocument();
    expect(screen.getByText('ISO')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('shows the no-EXIF message when there are no tags', () => {
    render(<ExifSection data={{ file: 'photo.jpg', exif: {}, histogram: null }} />);
    expect(screen.getByText('No EXIF data found')).toBeInTheDocument();
  });

  it('renders the histogram chart for each channel when present', () => {
    render(<ExifSection data={DATA_WITH_HISTOGRAM} />);
    expect(screen.getByText('Histogram')).toBeInTheDocument();
    expect(screen.getByTestId('histogram-r')).toBeInTheDocument();
    expect(screen.getByTestId('histogram-g')).toBeInTheDocument();
    expect(screen.getByTestId('histogram-b')).toBeInTheDocument();
    expect(screen.getByTestId('histogram-luma')).toBeInTheDocument();
  });

  it('names each histogram chart for screen readers', () => {
    render(<ExifSection data={DATA_WITH_HISTOGRAM} />);
    expect(screen.getByRole('img', { name: 'Red' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Green' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Blue' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Luma' })).toBeInTheDocument();
  });

  it('hides the histogram section when there is no histogram data', () => {
    render(<ExifSection data={{ file: 'photo.jpg', exif: { Make: 'Canon' }, histogram: null }} />);
    expect(screen.queryByTestId('histogram-r')).not.toBeInTheDocument();
  });
});
