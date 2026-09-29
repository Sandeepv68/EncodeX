import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoFiltersSection } from '../VideoFiltersSection';

describe('VideoFiltersSection', () => {
  it('renders an empty state when no filters are added', () => {
    render(<VideoFiltersSection filterEntries={[]} onChange={() => {}} disabled={false} />);
    expect(screen.getByTestId('video-filters-section')).toBeInTheDocument();
    expect(screen.getByTestId('filters-custom-input')).toBeInTheDocument();
    expect(screen.queryByTestId('filters-entry-0')).not.toBeInTheDocument();
    expect(screen.queryByTestId('filters-preview')).not.toBeInTheDocument();
  });

  it('adds a preset filter with default parameters', () => {
    const onChange = vi.fn();
    render(<VideoFiltersSection filterEntries={[]} onChange={onChange} disabled={false} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Crop' }));
    fireEvent.click(screen.getByTestId('filters-add-preset'));
    expect(onChange).toHaveBeenCalledWith(['crop=in_w:in_h']);
  });

  it('adds a preset filter with a custom parameter value', () => {
    const onChange = vi.fn();
    render(<VideoFiltersSection filterEntries={[]} onChange={onChange} disabled={false} />);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Sharpen' }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1.5' } });
    fireEvent.click(screen.getByTestId('filters-add-preset'));
    expect(onChange).toHaveBeenCalledWith(['unsharp=5:5:1.5:5:5:0']);
  });

  it('adds valid entries from a free-form custom chain', () => {
    const onChange = vi.fn();
    render(<VideoFiltersSection filterEntries={[]} onChange={onChange} disabled={false} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'fps=30, eq=brightness=0.1' } });
    fireEvent.click(screen.getByTestId('filters-add-custom'));
    expect(onChange).toHaveBeenCalledWith(['fps=30', 'eq=brightness=0.1']);
  });

  it('blocks a custom chain containing shell metacharacters', () => {
    const onChange = vi.fn();
    render(<VideoFiltersSection filterEntries={[]} onChange={onChange} disabled={false} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'fps=30;rm -rf /' } });
    expect(screen.getByTestId('filters-add-custom')).toBeDisabled();
    expect(screen.getByTestId('filters-custom-error').textContent).not.toBe('');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reorders entries', () => {
    const onChange = vi.fn();
    render(<VideoFiltersSection filterEntries={['fps=30', 'hflip']} onChange={onChange} disabled={false} />);
    fireEvent.click(screen.getByTestId('filters-move-up-1'));
    expect(onChange).toHaveBeenCalledWith(['hflip', 'fps=30']);
  });

  it('does not move the first entry up', () => {
    const onChange = vi.fn();
    render(<VideoFiltersSection filterEntries={['fps=30', 'hflip']} onChange={onChange} disabled={false} />);
    fireEvent.click(screen.getByTestId('filters-move-up-0'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes an entry', () => {
    const onChange = vi.fn();
    render(<VideoFiltersSection filterEntries={['fps=30', 'hflip']} onChange={onChange} disabled={false} />);
    fireEvent.click(screen.getByTestId('filters-remove-1'));
    expect(onChange).toHaveBeenCalledWith(['fps=30']);
  });

  it('clears all entries', () => {
    const onChange = vi.fn();
    render(<VideoFiltersSection filterEntries={['fps=30', 'hflip']} onChange={onChange} disabled={false} />);
    fireEvent.click(screen.getByTestId('filters-clear-all'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows a -vf chain preview', () => {
    render(<VideoFiltersSection filterEntries={['fps=30', 'hflip']} onChange={() => {}} disabled={false} />);
    expect(screen.getByTestId('filters-preview')).toHaveTextContent('fps=30,hflip');
  });

  it('disables every input in lossless copy mode', () => {
    render(<VideoFiltersSection filterEntries={['fps=30']} onChange={() => {}} disabled />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByTestId('filters-add-custom')).toBeDisabled();
  });
});
