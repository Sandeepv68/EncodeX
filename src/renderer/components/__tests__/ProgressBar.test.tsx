import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressBar from '../ProgressBar';

describe('ProgressBar', () => {
  it('renders progress with percentage (1 decimal)', () => {
    render(<ProgressBar percent={50} time="00:00:30" speed="1.5x" eta="30" />);
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    expect(screen.getByText(/00:00:30/)).toBeInTheDocument();
    expect(screen.getByText(/1.5x/)).toBeInTheDocument();
    expect(screen.getByText(/30s/)).toBeInTheDocument();
  });

  it('renders 0% progress', () => {
    render(<ProgressBar percent={0} time="00:00:00" speed="0x" eta="-" />);
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('renders 100% progress', () => {
    render(<ProgressBar percent={100} time="Done" speed="-" eta="0" />);
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });

  it('clamps percent to 0-100 range', () => {
    render(<ProgressBar percent={-10} />);
    expect(screen.getByText('0.0%')).toBeInTheDocument();
    render(<ProgressBar percent={150} />);
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });

  it('renders the track when shadowed is enabled', () => {
    render(<ProgressBar percent={50} shadowed />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('50.0%')).toBeInTheDocument();
  });
});
