import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TimeField from '../TimeField';

describe('TimeField', () => {
  it('renders the label and current value', () => {
    render(<TimeField label="Start" value="00:00:10" onChange={() => {}} />);
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByDisplayValue('00:00:10')).toBeInTheDocument();
  });

  it('shows placeholder when value is empty', () => {
    render(<TimeField label="Start" value="" placeholder="00:00:00" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('00:00:00')).toBeInTheDocument();
  });

  it('shows error helper text when error is provided', () => {
    render(<TimeField label="Start" value="bad" error="Invalid time" onChange={() => {}} />);
    expect(screen.getByText('Invalid time')).toBeInTheDocument();
  });

  it('fires onChange on input change', () => {
    const onChange = vi.fn();
    render(<TimeField label="Start" value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '00:00:05' } });
    expect(onChange).toHaveBeenCalledWith('00:00:05');
  });

  it('fires onBlur when the field loses focus', () => {
    const onBlur = vi.fn();
    render(<TimeField label="Start" value="" onChange={() => {}} onBlur={onBlur} />);
    fireEvent.blur(screen.getByRole('textbox'));
    expect(onBlur).toHaveBeenCalledOnce();
  });
});
