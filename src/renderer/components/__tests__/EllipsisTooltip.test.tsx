import { afterEach, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EllipsisTooltip from '../EllipsisTooltip';

const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
const originalClient = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

afterEach(() => {
  if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', originalScroll);
  if (originalClient) Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClient);
});

function mockOverflow() {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 200 });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 100 });
}

describe('EllipsisTooltip', () => {
  it('does not show a tooltip when content fits', () => {
    render(
      <EllipsisTooltip title="short">
        <span>short</span>
      </EllipsisTooltip>,
    );
    fireEvent.mouseOver(screen.getByText('short'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows a tooltip when content is truncated', async () => {
    mockOverflow();
    render(
      <EllipsisTooltip title="a very long value that overflows">
        <span>a very long value that overflows</span>
      </EllipsisTooltip>,
    );
    const value = screen.getByText('a very long value that overflows');
    fireEvent.mouseOver(value);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('a very long value that overflows');
  });

  it('makes truncated content keyboard-focusable and reveals the tooltip on focus', async () => {
    mockOverflow();
    render(
      <EllipsisTooltip title="a very long value that overflows">
        <span>a very long value that overflows</span>
      </EllipsisTooltip>,
    );
    const value = screen.getByText('a very long value that overflows');
    expect(value).toHaveAttribute('tabindex', '0');
    value.focus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('a very long value that overflows');
  });

  it('keeps non-truncated content out of the tab order', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: () => 0 });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 100 });
    render(
      <EllipsisTooltip title="short">
        <span>short</span>
      </EllipsisTooltip>,
    );
    expect(screen.getByText('short')).toHaveAttribute('tabindex', '-1');
  });
});
