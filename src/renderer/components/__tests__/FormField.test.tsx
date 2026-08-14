import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FormField from '../FormField';

describe('FormField', () => {
  it('renders the label, control, and helper text', () => {
    render(
      <FormField label="Output" helperText="Destination path">
        {(id) => <input id={id} type="text" />}
      </FormField>,
    );
    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(screen.getByText('Destination path')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAccessibleName('Output');
  });

  it('renders the required marker and keeps the exact label query working', () => {
    render(
      <FormField label="Output" required>
        {(id) => <input id={id} type="text" />}
      </FormField>,
    );
    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(screen.getByText('*', { selector: 'span' })).toBeInTheDocument();
  });

  it('shows the error text and flags it when error is provided', () => {
    render(
      <FormField label="Output" error="Required">
        {(id) => <input id={id} type="text" />}
      </FormField>,
    );
    expect(screen.getByText('Required')).toBeInTheDocument();
    const helper = screen.getByText('Required');
    expect(helper).toHaveClass('Mui-error');
  });

  it('associates the label with the control via the generated id', () => {
    render(<FormField label="Output">{(id) => <input id={id} type="text" />}</FormField>);
    const label = screen.getByText('Output');
    expect(label).toHaveAttribute('for');
    expect(label).toHaveAttribute('for', screen.getByRole('textbox').id);
  });

  it('calls the render prop with the explicit htmlFor id', () => {
    const child = vi.fn(() => <input type="text" />);
    render(<FormField label="Output" htmlFor="my-id" children={child} />);
    expect(child).toHaveBeenCalledWith('my-id');
  });

  it('fires nothing when a plain click happens on the field box', () => {
    const child = vi.fn(() => <input type="text" />);
    render(<FormField label="Output" children={child} />);
    fireEvent.click(screen.getByText('Output'));
    expect(child).toHaveBeenCalled();
  });

  it('renders the hint as a focusable, named tooltip trigger', () => {
    render(
      <FormField label="Output" hint="Explains the field">
        {(id) => <input id={id} type="text" />}
      </FormField>,
    );
    const trigger = screen.getByTestId('info-tooltip');
    expect(trigger).toHaveAttribute('tabindex', '0');
    expect(trigger).toHaveAttribute('role', 'button');
    expect(trigger).toHaveAccessibleName('Explains the field');
  });
});
