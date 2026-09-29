import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MediaPreview from '../MediaPreview';

describe('MediaPreview', () => {
  it('renders the thumbnail and a labeled remove button', () => {
    render(<MediaPreview imageSrc="data:image/png;base64,xyz" alt="photo.png" removeLabel="remove photo" onRemove={vi.fn()} />);
    expect(screen.getByAltText('photo.png')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'remove photo' })).toBeInTheDocument();
  });

  it('straddles the thumbnail top-end corner with a large enough hit area', () => {
    render(<MediaPreview imageSrc="data:image/png;base64,xyz" alt="photo.png" removeLabel="remove photo" onRemove={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'remove photo' });
    const style = getComputedStyle(button);
    expect(parseFloat(style.width)).toBeGreaterThanOrEqual(36);
    expect(parseFloat(style.height)).toBeGreaterThanOrEqual(36);
    // Anchored to the corner, then pushed outwards by half its size so the
    // badge sits on the corner rather than inside the thumbnail.
    expect(style.top).toBe('0px');
    expect(style.insetInlineEnd).toBe('0px');
    expect(style.transform).toBe('translate(50%, -50%)');
  });

  it('reserves the thumbnail footprint per variant so the button keeps its corner without an image', () => {
    const { rerender } = render(
      <MediaPreview imageSrc={null} alt="clip.mkv" removeLabel="remove clip" variant="wide" onRemove={vi.fn()} />,
    );
    const wide = getComputedStyle(screen.getByRole('button', { name: 'remove clip' }).parentElement as HTMLElement);
    expect(wide.width).toBe('160px');
    expect(wide.height).toBe('90px');

    rerender(<MediaPreview imageSrc={null} alt="photo.png" removeLabel="remove photo" onRemove={vi.fn()} />);
    const square = getComputedStyle(screen.getByRole('button', { name: 'remove photo' }).parentElement as HTMLElement);
    expect(square.width).toBe('96px');
    expect(square.height).toBe('96px');
  });
});
