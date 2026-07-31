import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilePathField from '../FilePathField';

const baseProps = {
  label: 'Input',
  value: '/path/to/file.mp4',
  placeholder: 'Choose a file',
  buttonLabel: 'Browse',
  onBrowse: vi.fn(),
};

describe('FilePathField', () => {
  it('renders label, value, placeholder and browse button', () => {
    render(<FilePathField {...baseProps} />);
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByDisplayValue('/path/to/file.mp4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse' })).toBeInTheDocument();
  });

  it('calls onBrowse when the button is clicked', () => {
    render(<FilePathField {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }));
    expect(baseProps.onBrowse).toHaveBeenCalledOnce();
  });

  it('fires onChange when editing', () => {
    const onChange = vi.fn();
    render(<FilePathField {...baseProps} onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '/new/path' } });
    expect(onChange).toHaveBeenCalledWith('/new/path');
  });

  it('fires onBlur when the field loses focus', () => {
    const onBlur = vi.fn();
    render(<FilePathField {...baseProps} onBlur={onBlur} />);
    fireEvent.blur(screen.getByRole('textbox'));
    expect(onBlur).toHaveBeenCalledOnce();
  });

  it('shows the error helper text when provided', () => {
    render(<FilePathField {...baseProps} error="No file selected" />);
    expect(screen.getByText('No file selected')).toBeInTheDocument();
  });
});
