import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CodecSelect from '../CodecSelect';

describe('CodecSelect', () => {
  it('shows video codecs for video type', async () => {
    render(<CodecSelect type="video" value="libx264" onChange={() => {}} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(await screen.findByRole('option', { name: 'H.264 (libx264)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'AAC (native)' })).not.toBeInTheDocument();
  });

  it('shows audio codecs for audio type', async () => {
    render(<CodecSelect type="audio" value="aac" onChange={() => {}} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    expect(await screen.findByRole('option', { name: 'AAC (native)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'H.264 (libx264)' })).not.toBeInTheDocument();
  });

  it('reports the selected video codec', async () => {
    const onChange = vi.fn();
    render(<CodecSelect type="video" value="libx264" onChange={onChange} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const option = await screen.findByRole('option', { name: 'H.265/HEVC (libx265)' });
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith('libx265');
  });

  it('reports the selected audio codec', async () => {
    const onChange = vi.fn();
    render(<CodecSelect type="audio" value="aac" onChange={onChange} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const option = await screen.findByRole('option', { name: 'MP3 (LAME)' });
    fireEvent.click(option);
    expect(onChange).toHaveBeenCalledWith('libmp3lame');
  });
});
