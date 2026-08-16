import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProgressBar from '../ProgressBar';
import { assertNoAxeViolations } from '../../../test-utils/axe';

describe('ProgressBar', () => {
  it('has no axe violations', async () => {
    const { container } = render(<ProgressBar percent={42} />);
    await assertNoAxeViolations(container);
  });
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

  it('omits the percentage and detail captions in minimal mode', () => {
    render(<ProgressBar percent={42} time="00:00:30" speed="1.5x" eta="30" minimal />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText('42.0%')).not.toBeInTheDocument();
    expect(screen.queryByText(/00:00:30/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1.5x/)).not.toBeInTheDocument();
    expect(screen.queryByText(/30s/)).not.toBeInTheDocument();
  });

  it('exposes the progressbar with an accessible name and value', () => {
    render(<ProgressBar percent={42} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAccessibleName('progress.title');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
  });

  it('announces completion via a live region at 100%', () => {
    const { rerender } = render(<ProgressBar percent={75} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    rerender(<ProgressBar percent={100} />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('toast.conversionComplete');
  });
});
