import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from '../Footer';

describe('Footer', () => {
  it('renders the app name, version and powered-by line', () => {
    render(<Footer />);
    expect(screen.getByText(/app\.name/)).toBeInTheDocument();
    expect(screen.getByText(/footer\.version/)).toBeInTheDocument();
    expect(screen.getByText('footer.poweredBy')).toBeInTheDocument();
  });

  it('renders the FFmpeg banner image', () => {
    render(<Footer />);
    const img = screen.getByAltText('FFmpeg');
    expect(img).toBeInTheDocument();
  });
});
