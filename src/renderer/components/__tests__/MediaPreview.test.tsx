import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MediaPreview from '../MediaPreview';

describe('MediaPreview', () => {
  it('renders the thumbnail and a labeled remove button', () => {
    render(<MediaPreview imageSrc="data:image/png;base64,xyz" alt="photo.png" removeLabel="remove photo" onRemove={vi.fn()} />);
    expect(screen.getByAltText('photo.png')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'remove photo' })).toBeInTheDocument();
  });

  it('keeps the remove button inside the thumbnail bounds with a large enough hit area', () => {
    render(<MediaPreview imageSrc="data:image/png;base64,xyz" alt="photo.png" removeLabel="remove photo" onRemove={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'remove photo' });
    const style = getComputedStyle(button);
    expect(parseFloat(style.width)).toBeGreaterThanOrEqual(36);
    expect(parseFloat(style.height)).toBeGreaterThanOrEqual(36);
    expect(style.top).toBe('0px');
    expect(style.insetInlineEnd).toBe('0px');
  });
});
